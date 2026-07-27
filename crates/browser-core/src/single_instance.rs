//! Single-instance local socket: second launch delivers argv to the first.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, Sender};
use std::thread;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SingleInstanceError {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("already running; argv delivered to primary")]
    DeliveredToPrimary,
}

/// Coordinates a primary instance and routes secondary argv payloads to it.
pub struct SingleInstanceServer {
    port_file: PathBuf,
    tx: Sender<Vec<String>>,
    rx: Receiver<Vec<String>>,
    _listener_held: Option<TcpListener>,
}

impl SingleInstanceServer {
    /// Attempt to become the primary instance. If another primary holds the
    /// port file, deliver `argv` and return `DeliveredToPrimary`.
    pub fn acquire(lock_dir: &Path, argv: &[String]) -> Result<Self, SingleInstanceError> {
        std::fs::create_dir_all(lock_dir)?;
        let port_file = lock_dir.join("browser-core.single-instance.port");

        if port_file.exists() {
            if let Ok(port_s) = std::fs::read_to_string(&port_file) {
                if let Ok(port) = port_s.trim().parse::<u16>() {
                    if let Ok(mut stream) = TcpStream::connect(("127.0.0.1", port)) {
                        let payload = argv.join("\n");
                        stream.write_all(payload.as_bytes())?;
                        // EOF so the primary's read_to_string completes promptly.
                        let _ = stream.shutdown(std::net::Shutdown::Both);
                        return Err(SingleInstanceError::DeliveredToPrimary);
                    }
                }
            }
            // Stale port file: replace.
            let _ = std::fs::remove_file(&port_file);
        }

        let listener = TcpListener::bind(("127.0.0.1", 0))?;
        let port = listener.local_addr()?.port();
        std::fs::write(&port_file, port.to_string())?;

        let (tx, rx) = mpsc::channel();
        let tx_bg = tx.clone();
        thread::spawn(move || {
            for conn in listener.incoming().flatten() {
                let mut buf = String::new();
                let mut stream = conn;
                if stream.read_to_string(&mut buf).is_ok() {
                    let args: Vec<String> = buf
                        .lines()
                        .filter(|l| !l.is_empty())
                        .map(str::to_string)
                        .collect();
                    let _ = tx_bg.send(args);
                }
            }
        });

        // Keep a second bind attempt blocked by the port file; the listener
        // moved into the thread. We do not hold the listener here.
        Ok(Self {
            port_file,
            tx,
            rx,
            _listener_held: None,
        })
    }

    pub fn try_recv_argv(&self) -> Option<Vec<String>> {
        self.rx.try_recv().ok()
    }

    pub fn sender(&self) -> Sender<Vec<String>> {
        self.tx.clone()
    }
}

impl Drop for SingleInstanceServer {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.port_file);
    }
}

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SurfaceId {
    Overview,
    Entities,
    Receipts,
    Watch,
    Graph,
}

impl SurfaceId {
    pub const ALL: [Self; 5] = [
        Self::Overview,
        Self::Entities,
        Self::Receipts,
        Self::Watch,
        Self::Graph,
    ];

    pub const fn title(self) -> &'static str {
        match self {
            Self::Overview => "Store overview",
            Self::Entities => "Golden entities",
            Self::Receipts => "Receipts",
            Self::Watch => "Standing watch",
            Self::Graph => "Graph neighborhood",
        }
    }
}

pub trait DockHost: Send + Sync {
    fn layout_key(&self) -> &str;
    fn load_layout(&self) -> io::Result<Option<Vec<u8>>>;
    fn save_layout(&self, bytes: &[u8]) -> io::Result<()>;
}

pub trait SurfaceHost {
    fn surfaces(&self) -> &[SurfaceId];
    fn active_surface(&self) -> SurfaceId;
    fn activate_surface(&mut self, surface: SurfaceId);
}

pub trait Shell {
    type Dock: DockHost;
    type Surfaces: SurfaceHost;

    fn dock_host(&self) -> &Self::Dock;
    fn surface_host(&self) -> &Self::Surfaces;
    fn surface_host_mut(&mut self) -> &mut Self::Surfaces;
}

#[derive(Clone, Debug)]
pub struct FileDockHost {
    key: String,
    path: PathBuf,
}

impl FileDockHost {
    pub fn new(key: impl Into<String>, path: impl Into<PathBuf>) -> Self {
        Self {
            key: key.into(),
            path: path.into(),
        }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }
}

impl DockHost for FileDockHost {
    fn layout_key(&self) -> &str {
        &self.key
    }

    fn load_layout(&self) -> io::Result<Option<Vec<u8>>> {
        match fs::read(&self.path) {
            Ok(bytes) => Ok(Some(bytes)),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
            Err(error) => Err(error),
        }
    }

    fn save_layout(&self, bytes: &[u8]) -> io::Result<()> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&self.path, bytes)
    }
}

#[derive(Clone, Debug)]
pub struct SurfaceRegistry {
    surfaces: Vec<SurfaceId>,
    active: SurfaceId,
}

impl Default for SurfaceRegistry {
    fn default() -> Self {
        Self {
            surfaces: SurfaceId::ALL.to_vec(),
            active: SurfaceId::Overview,
        }
    }
}

impl SurfaceHost for SurfaceRegistry {
    fn surfaces(&self) -> &[SurfaceId] {
        &self.surfaces
    }

    fn active_surface(&self) -> SurfaceId {
        self.active
    }

    fn activate_surface(&mut self, surface: SurfaceId) {
        if self.surfaces.contains(&surface) {
            self.active = surface;
        }
    }
}

pub struct NativeShell<D, S> {
    dock: D,
    surfaces: S,
}

impl<D, S> NativeShell<D, S> {
    pub fn new(dock: D, surfaces: S) -> Self {
        Self { dock, surfaces }
    }
}

impl<D, S> Shell for NativeShell<D, S>
where
    D: DockHost,
    S: SurfaceHost,
{
    type Dock = D;
    type Surfaces = S;

    fn dock_host(&self) -> &Self::Dock {
        &self.dock
    }

    fn surface_host(&self) -> &Self::Surfaces {
        &self.surfaces
    }

    fn surface_host_mut(&mut self) -> &mut Self::Surfaces {
        &mut self.surfaces
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_layout_round_trips_across_shell_instances() {
        let path = std::env::temp_dir().join(format!(
            "commonplace-console-layout-{}.json",
            std::process::id()
        ));
        let first = FileDockHost::new("console-layout-v1", &path);
        first.save_layout(br#"{"version":1}"#).expect("save layout");

        let second = FileDockHost::new("console-layout-v1", &path);
        assert_eq!(
            second.load_layout().expect("load layout"),
            Some(br#"{"version":1}"#.to_vec())
        );
        fs::remove_file(path).expect("remove test layout");
    }

    #[test]
    fn surface_registry_rejects_no_declared_surface() {
        let mut surfaces = SurfaceRegistry::default();
        for surface in SurfaceId::ALL {
            surfaces.activate_surface(surface);
            assert_eq!(surfaces.active_surface(), surface);
        }
        assert_eq!(surfaces.surfaces(), SurfaceId::ALL);
    }
}

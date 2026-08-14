#!/usr/bin/env python3
"""Walk frames BACKWARD from a boundary to find the true body end."""
import struct, zlib, hashlib

PATH = "/Volumes/SSD Samsung/theorem-local-node/tenants/tenant-5e592fbb713f81b387282860b9985c8cec07ca4c7d766168cb15395d99fdee5a/redcore.journal"
BOUNDARY = 37_209_150_971  # end of the frame found by the forward walk

def read_at(f, off, n):
    f.seek(off)
    return f.read(n)

def parse_frame(data):
    if data[:4] != b"RRCJ" or data[4] != 1:
        return None
    kind = data[5]
    address = data[6:38]
    decoded_len = struct.unpack("<I", data[38:42])[0]
    encoding = data[42]
    encoded_len = struct.unpack("<I", data[43:47])[0]
    payload = data[47:47+encoded_len]
    if len(payload) != encoded_len:
        return None
    crc_bytes = data[47+encoded_len:47+encoded_len+4]
    if len(crc_bytes) != 4:
        return None
    crc = struct.unpack("<I", crc_bytes)[0]
    if zlib.crc32(data[:47] + payload) & 0xFFFFFFFF != crc:
        return None
    return {"kind": kind, "address": address, "payload": payload,
            "frame_len": 47 + encoded_len + 4}

def decode_root(payload):
    if payload[0] != 4 or payload[1] != 2:
        return None
    root = payload[2:34]
    n = struct.unpack("<I", payload[34:38])[0]
    off = 38
    parents = []
    for _ in range(n):
        parents.append(payload[off:off+32]); off += 32
    alen = struct.unpack("<I", payload[off:off+4])[0]; off += 4
    author = payload[off:off+alen]; off += alen
    mlen = struct.unpack("<I", payload[off:off+4])[0]; off += 4
    message = payload[off:off+mlen]; off += mlen
    return {"root": root, "parents": parents, "author": author, "message": message,
            "commit": hashlib.sha256(payload).digest()}

with open(PATH, "rb") as f:
    size = f.seek(0, 2)

    # --- the 184-byte frame before the orphan root ---
    off = BOUNDARY - 184
    data = read_at(f, off, 184 + 16)
    fr = parse_frame(data)
    print(f"frame at {off}: {fr}")
    if fr:
        if fr["kind"] == 2:
            dec = decode_root(fr["payload"])
            print(f"  root: commit={dec['commit'][:16].hex()} parents={[p[:8].hex() for p in dec['parents']]} msg={dec['message']!r}")
        else:
            print(f"  chunk: addr={fr['address'][:8].hex()} decoded_len={len(fr['payload'])}")

    # --- walk backward from BOUNDARY ---
    boundary = BOUNDARY
    roots = []
    steps = 0
    while boundary > 0 and steps < 200000:
        # find RRCJ in the last 8MB before boundary
        lo = max(0, boundary - 8*1024*1024)
        chunk = read_at(f, lo, boundary - lo)
        idx = chunk.rfind(b"RRCJ")
        if idx < 0:
            print(f"no more magics before {boundary}; body end = {boundary}")
            break
        cand = lo + idx
        data = read_at(f, cand, 47)
        fr = parse_frame(data + read_at(f, cand + 47, 4*1024*1024))
        if fr is None or cand + fr["frame_len"] != boundary:
            # not the previous frame; keep searching before this candidate
            chunk2 = chunk[:idx]
            idx2 = chunk2.rfind(b"RRCJ")
            if idx2 < 0:
                print(f"stopped at {boundary} (candidate {cand} invalid)")
                break
            # retry with the earlier candidate
            cand = lo + idx2
            data = read_at(f, cand, 47)
            fr = parse_frame(data + read_at(f, cand + 47, 4*1024*1024))
            if fr is None or cand + fr["frame_len"] != boundary:
                print(f"stopped at {boundary} (candidate {cand} invalid too)")
                break
        if fr["kind"] == 2:
            dec = decode_root(fr["payload"])
            roots.append((cand, dec, fr["address"]))
        boundary = cand
        steps += 1
        if steps % 10000 == 0:
            print(f"... {steps} frames walked, at {boundary}")

    print(f"\nwalked {steps} frames; TRUE BODY END = {boundary}")
    print(f"roots seen: {len(roots)}")
    if roots:
        loff, dec, addr = roots[-1]
        print(f"LAST BODY ROOT at {loff}: commit={dec['commit'].hex()}")
        print(f"  parent={dec['parents'][0].hex() if dec['parents'] else None} msg={dec['message']!r}")
        print(f"  addr_match={addr == dec['commit']}")
        print(f"  ORPHAN.parent == last-body-root.commit: {dec['commit'] == bytes.fromhex('080e0bfe8c67ea759cf3a77ffc4bea7612a3e58ace419912923066ea1f05c6fb')}")

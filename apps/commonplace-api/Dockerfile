# Dockerfile for commonplace-api from the CommonPlace product repo.
#
# The API source lives here now, but its RustyRed/Theorem crate dependencies are
# still source-of-truth in the Theorem repo. For remote builds this bridge clones
# Theorem next to CommonPlace so the local path dependencies in Cargo.toml
# resolve. Pin THEOREM_REF to a branch or commit that contains the required
# crate API. Long term, replace this with published or git-pinned crate deps.

FROM rust:1.95-bookworm AS builder
WORKDIR /workspace

ARG THEOREM_GIT=https://github.com/Travis-Gilbert/Theorem.git
ARG THEOREM_REF=main

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY . /workspace/CommonPlace
RUN git clone --depth 1 --branch "${THEOREM_REF}" "${THEOREM_GIT}" /workspace/Theorem

WORKDIR /workspace/CommonPlace/apps/commonplace-api
RUN cargo build --release --bin commonplace-api

FROM debian:bookworm-slim
# Runtime: ca-certificates for outbound TLS (rustls roots).
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /workspace/CommonPlace/apps/commonplace-api/target/release/commonplace-api /usr/local/bin/commonplace-api

# Reads PORT from env, binds [::]:$PORT (IPv6 dual-stack so Railway's IPv6
# private network + healthcheck reach it; also accepts IPv4). EXPOSE is docs only.
EXPOSE 8080
CMD ["commonplace-api"]

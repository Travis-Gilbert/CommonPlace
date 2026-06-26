# Paper Trail: Implementation Specification

> **System**: travisgilbert.me ecosystem
> **Branding**: "Paper Trail" (replaces "Research Trail" everywhere)
> **Architecture**: Django + HTMX + Cotton on Railway (shared project with draftroom)
> **Public URL**: research.travisgilbert.me/paper-trail/
> **Private URL**: draftroom.travisgilbert.me/sourcebox/

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        RAILWAY PROJECT                          │
│                                                                 │
│  ┌──────────────────────┐    ┌───────────────────────────────┐  │
│  │  draftroom (Django)  │    │  research_api (Django REST)   │  │
│  │                      │    │                               │  │
│  │  /sourcebox/         │◄──►│  /api/v1/sources/            │  │
│  │    Quick capture UI  │    │  /api/v1/threads/            │  │
│  │    RawSource model   │    │  /api/v1/graph/              │  │
│  │    Triage dashboard  │    │  /api/v1/trail/<slug>/       │  │
│  │                      │    │                               │  │
│  │  /connections/       │    │  /paper-trail/  (PUBLIC)      │  │
│  │    SuggestedConn.    │    │    Graph explorer             │  │
│  │    Approve/dismiss   │    │    Thread timelines           │  │
│  │                      │    │    Source suggestion form     │  │
│  └──────────────────────┘    │    Community wall             │  │
│           │                  └───────────────────────────────┘  │
│           │  SHARED DATABASE                                    │
│           └──────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                    publisher (commits JSON)
                              │
                    ┌─────────▼───────────┐
                    │  travisgilbert.me    │
                    │  (Next.js / Vercel)  │
                    │                     │
                    │  Essay Paper Trail   │
                    │  Homepage section    │
                    │  Embedded graph      │
                    │  OG images w/ stats  │
                    └─────────────────────┘
```

See full specification in the downloaded file.
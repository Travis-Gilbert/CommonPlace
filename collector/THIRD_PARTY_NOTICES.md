# Third-party notices

## AnythingLLM

This parse-only peer boundary was designed after reviewing
`Mintplex-Labs/anything-llm` commit
`633fc1960914298009134b40c25007cb422c7884`, especially `collector/index.js`
and `server/utils/collectorApi/index.js`.

The CommonPlace implementation replaces the inherited shared hot directory,
shared output storage, rotating key files, and development auth bypass with an
explicit byte protocol and peer credential. The complete upstream MIT license
is retained in `LICENSE.anything-llm`.

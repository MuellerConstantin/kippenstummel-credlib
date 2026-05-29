# Project Overview

**Kippenstummel** is a community-driven platform for collaboratively mapping and
rating cigarette vending machines (CVMs). Users can register CVM locations,
verify and correct positions, and rate machines based on availability and
functionality. A reputation system based on karma and trust scores ensures
data quality through swarm intelligence — rewarding reliable contributors and
surfacing inaccurate or outdated entries.

The platform consists of four components:

- **API** — backend service providing the core business logic, data persistence,
  and REST API consumed by all other components
- **Web** — browser-based map frontend for end users; allows registering, locating,
  and rating CVMs, and manages anonymous user identities and karma
- **KMC** _(Kippenstummel Management Console)_ — internal tooling for moderators
  to review reported machines, manage trust scores, and handle abuse cases
- **CredLib** — utility library containing algorithms for calculating
  an user's credibility.

This repository contains the **CredLib** component of the Kippenstummel project.

## Functionality

Kippenstummel is a crowd-sourced map of cigarette vending machines (CVMs). The
core use case is simple: users report CVM locations, and the community
collectively verifies and maintains their accuracy over time.

**Map & Discovery**
The map displays all registered CVMs, clustered at lower zoom levels for
clarity. Each machine is represented by a badge-coded marker reflecting its
current trust level, derived from its score (ranging from -10 to +10):

- **Top Rated** (+5 to +10) — repeatedly confirmed as working and correctly located
- **Neutral** (0 to +4) — not yet well-verified or mixed feedback
- **Bad** (-1 to -7) — frequently reported as missing or defective
- **For Deletion** (-8 to -10) — likely invalid; pending removal

**CVM Lifecycle**
Any registered user can submit a new CVM location. When submitting, the
reporter provides the exact coordinates (typically via GPS). From that point,
the community takes over: users who encounter the machine in the real world can
upvote it (working, correctly placed) or downvote it (missing, broken, wrong
location). If a machine's position is slightly off, any user can propose a
coordinate correction without re-registering it. In severe cases — spam,
abuse, or gross misplacement — machines can be flagged for moderator review.

**Identity & Anonymity**
Active participation requires an account, but Kippenstummel avoids traditional
registration. Instead, users receive an anonymous identity — no email, no phone
number. This identity is personal and persistent, and tied to all interactions
on the platform.

**Karma & Permissions**
Every user accumulates karma based on the quality and reception of their
contributions. Registering machines that other users confirm as accurate
increases karma; contributing low-quality or incorrect data decreases it.
Karma directly influences a user's permissions and ability to act on the
platform, creating a self-regulating trust hierarchy.

**Moderation**
Moderators operate independently of the crowd-rating system and handle
escalated cases — abuse reports, spam, or systematic data manipulation — that
fall outside what swarm intelligence alone can resolve reliably.

## Tech Stack

- **Language**: TypeScript 5+, compiled to CommonJS via `tsc`
- **Testing**: Jest with `ts-jest`
- **No runtime dependencies** — pure TypeScript logic only

## Design Decisions

- **Pure functions, no side effects**: The entire library consists of
  stateless, side-effect-free functions. `computeCredibility` and all
  evaluation rules are pure — given the same `BehaviourInfo`, they always
  return the same result. This makes them trivially testable and safe to
  call from any context.
- **Rule-based heuristic with traceable deltas**: The credibility score is
  computed by applying a set of named penalty rules sequentially against a
  baseline of 100. Each rule returns a signed delta. An optional `trace` map
  can be passed to record each rule's contribution, making scoring decisions
  fully observable and debuggable without touching the core logic.
- **EWMA smoothing**: The final score is smoothed against the user's previous
  credibility using an exponentially weighted moving average (α = 0.4). This
  prevents single outlier events from causing abrupt score swings.
- **Logistic age weighting**: Penalties for high interaction frequency are
  weighted by a logistic function over identity age. New identities are not
  penalized for short interaction intervals; the full penalty weight only
  applies once the identity is sufficiently established.
- **Distance-aware movement detection**: Unrealistic movement is detected by
  comparing calculated travel speed against thresholds that scale with
  distance — stricter for short distances (walking/cycling range), more
  lenient for long distances where air travel is plausible.
- **Zero runtime dependencies**: The library has no production dependencies.
  All logic — EWMA, Haversine distance, speed calculation, penalty rules — is
  implemented directly. This keeps the package lightweight and avoids supply
  chain risk for a security-relevant component.

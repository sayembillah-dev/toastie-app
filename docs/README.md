# Documentation index

This folder holds the project documentation for Toastie: what it is, how it
is built, its data model, and where it is headed. These documents were
reconstructed from the shipped codebase and git history on 2026-08-31, since
the project did not have them written up front. Keep them updated as the
product changes; treat the code and schema as the source of truth if a
document and the code disagree.

| Document                                           | Purpose                                                                                                    |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [PRD.md](./PRD.md)                                 | Product requirements: problem, users, goals, non-goals, functional requirements by module                  |
| [TDD.md](./TDD.md)                                 | Technical design: architecture, frontend, backend, authentication, authorization, file storage, deployment |
| [ERD.md](./ERD.md)                                 | Entity relationship diagram and full data model, generated from the Prisma schema                          |
| [ROADMAP.md](./ROADMAP.md)                         | What is delivered, what is actively being worked on, what is next, and explicit non-goals                  |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Concrete steps for the roadmap's near-term items, and conventions new features should follow               |
| [DEPLOYMENT.md](./DEPLOYMENT.md)                   | Operational deployment reference: server setup, secrets, CI/CD, rollback                                   |

The repository root [README.md](../README.md) remains the best starting
point for a developer setting up the project locally: getting started,
environment variables, scripts, and repository layout.

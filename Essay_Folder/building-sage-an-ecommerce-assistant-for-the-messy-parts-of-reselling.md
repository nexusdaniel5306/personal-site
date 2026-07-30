---
title: How I built a super assistant to sell plastic online
date: 2026-07-29
excerpt: How I built a private ecommerce operations assistant to connect orders, packages, inventory, profit, and tax records without hiding the messy parts.
---

Selling something online sounds like one transaction. I make a listing, someone buys the item, I print the label, and the package gets shipped. When I started selling custom minifigures online three years ago as a hobby, that was exactly how simple it felt. I loved the process, and fulfilling orders was extremely satisfying.

By this year, I had dozens-folded my inventory and had several sales accounts to keep track of. My old method was not cutting anymore. In any given week, I was spending hours fulfilling orders, synchronizing shipping and accounting documents, managing customer communications, and handling customer service.

I had tools that could show me each piece separately. The marketplaces knew what had sold. A carrier knew where the package was. PayPal knew which payments and fees had moved through the account. Gmail held shipping confirmations and receipts. But none of them could answer the complete question I actually cared about: What needs my attention, and what did I really earn?

As I prepared for my first year of grad school, I considered giving up online selling altogether. I was afraid I would not be able to balance school with giving my customers a satisfactory buying experience. The disorganization was also costing me real money. Late shipments came with penalties, and messy accounting meant I often owed more than expected when tax day came around.

That problem became Sage, a private ecommerce operations and financial-record assistant for my small resale business. Sage acts as the connective tissue between the services I already use, with a carefully designed backend that keeps the economics of my business in sync. Its job is to make the daily work obvious and preserve enough evidence that the financial story still makes sense months later, when it is time to report it.


## The Four Questions

I started the project by reducing the product to four questions, which are all at the top of my attention any given day or week:

```text
What needs to ship?
Who has questions, and how can I answer them?
What is the status of my inbound and outbound packages?
Which records are still incomplete for tax preparation?
```

These questions sound simple, but each one crosses the boundaries between multiple systems. An eBay order may say that an item sold for $100, but that is not $100 of profit. Buyer-paid shipping, marketplace fees, advertising fees, payment fees, label cost, refunds, cost of goods sold, and other direct expenses all have to be connected to the same order.

The same problem appears operationally. A tracking number by itself is not useful if it is detached from the order it belongs to. A receipt in Gmail is not useful at tax time if I cannot remember which inventory lot or business expense it supports. Sage was designed around these connections rather than around one more set of isolated tables.

## The proactive design of Sage

Many business applications open with charts. Charts are great for looking backward, but they are often a poor answer to the question, “What should I do right now?” I wanted Sage to behave more like a workbench.

The Today page leads with orders ready to ship, overdue fulfillment deadlines, tracking exceptions, missing cost of goods sold, uncategorized transactions, and expenses without receipt evidence. Every count comes from a deterministic database query and links back to the records causing it. If the page says three orders are missing COGS, I can open those three orders and resolve the problem instead of admiring a red number.

This idea shaped the rest of the interface. Orders have a searchable fulfillment queue. Packages have inbound and outbound views, event timelines, and attention flags for exceptions or a lack of movement. Expenses keep missing receipts visible. Reports remain marked as drafts while important data is incomplete. The software is allowed to say “I do not know yet.”

## Choosing a Deliberately Boring Architecture

Sage was built for one operator and designed to run continuously on `danserver`, the small home Docker server I wrote about in [a previous post](scrapping-together-a-tiny-docker-server-from-old-gaming-pc-parts.html). That constraint made the architecture decision much easier.

I considered the familiar production stack and got input from Codex: a frontend, an API, a separate background worker, Postgres, and Redis. It would have offered more independent scaling and concurrency, but Sage has one user and a small amount of periodic, mostly input-output-bound work. Five services would have created more maintenance and more ways to fail without making the application meaningfully better.

Instead, Sage is a modular monolith:

```text
Browser
  -> React and Vite
      -> Fastify API
          -> domain services and provider adapters
          -> scheduler and durable job worker
          -> SQLite database in WAL mode

/data
  -> sage.db
  -> attachments
  -> exports
  -> backups
```

The React application, API, scheduler, and background worker share one Node process and one Docker container. Jobs are persisted in SQLite, so a restart does not erase queued work. The database, attachments, reports, and backups live in one persistent `/data` mount. Deployment and recovery involve one service and one clearly defined set of data.

Provider adapters, migrations, jobs, and domain services are explicitely separated so the database or worker can be extracted later if real usage demands it. Until then, SQLite and one container are the right amount of infrastructure.

## Where Financial Correctness Gets Uncomfortable

The most difficult part of Sage was not building forms or calling APIs. It was deciding what every number meant and what the application should do when a number was missing.

Money is stored as signed integer cents with an explicit currency, avoiding floating-point surprises. Imported source values and raw provider payloads are preserved separately from manual corrections. Imports are idempotent, which means running the same eBay or PayPal synchronization twice updates the existing record rather than creating a duplicate. A malformed source record becomes a visible error without discarding everything else in the import.

Most importantly, missing values stay missing. Sage does not quietly turn an unknown fee or unknown cost basis into zero just to produce a cleaner-looking profit number. An order’s estimate is built from visible components:

```text
item revenue
+ buyer-paid shipping
- marketplace fees
- advertising fees
- payment fees
- label cost
- refunds
- cost of goods sold
- linked order expenses
= estimated profit
```

Marketplace-collected sales tax is displayed for reconciliation but excluded from seller revenue. If COGS is unknown, the estimate is visibly incomplete. That can be less satisfying than showing a confident green number, but it is much more useful.

Sage also treats accepted matches, allocations, and categorizations as reversible decisions. Linking a PayPal settlement to an eBay order should prevent double-counting, but reversing that link should restore the previous state and leave an audit trail. Matching a sold item to inventory consumes it atomically so it cannot be used as the cost basis for a second sale. Reversing the match makes it available again.

## Inventory Is Easy Until It Comes in a Lot

Individual inventory purchases are straightforward. Lots are where the bookkeeping becomes interesting. If I buy ten items together for one price, the total cost must be allocated before I can know the profit on any one of them.

Sage supports equal, percentage, and manual allocation. The calculation uses integer cents, assigns any remainder deterministically, and verifies that every allocation adds back to the exact purchase total. Items can then be matched to sold order lines by stable identifiers first and normalized title similarity second.

This module intentionally stops short of becoming a warehouse-management system. I do not need robots or shelf-optimization algorithms. I need enough inventory provenance to know what was sold, what it cost, which account owns it, and which unsold items remain.

## One Business, Multiple Books

Another deceptively hard requirement was supporting more than one sales account without letting their records blur together. Sage creates a separate reporting book for each eBay or PayPal sales account, plus a permanent Shared Opex book for costs that belong to the business as a whole.

Orders, inventory, transactions, direct expenses, reconciliation, and account reports stay inside their sales books. Today and Packages combine everything because the physical work still happens in one place. General expenses remain one operational list but can be filtered by book. Shared overhead appears only in the consolidated master report.

This boundary matters. Two eBay accounts can legally return the same provider order identifier. An inventory item belonging to one account should not silently become COGS for another. Sage scopes provider identities and financial links by book, and an inventory transfer creates an audit event instead of rewriting history.

## Connecting eBay, PayPal, Gmail, and Packages

Sage’s integrations are built behind provider-neutral adapters with live, fixture, and manual modes. Fixture mode creates a deterministic working business for development and tests. Manual mode keeps the application honest before credentials are configured. Live adapters handle the real provider APIs.

The eBay integration imports orders, line items, fulfillment data, fees, refunds, and source identifiers. It can add tracking and push a fulfillment update back to the correct account. PayPal imports transactions in the provider’s limited date windows and retains gross amount, fees, net amount, status, event code, and source evidence for classification and reconciliation.

Gmail uses read-only access. Deterministic parsers look for shipping confirmations and receipts, but extracted records are staged for review rather than immediately becoming financial truth. The user can edit, accept, or dismiss a discovery. Sage stores only the identifiers, minimal headers, bounded evidence, and fields it needs instead of copying an entire mailbox into its database.

Packages connect the operational side. Outbound shipments originate from fulfillment records, while inbound shipments can come from an accepted Gmail discovery or manual entry. Tracking numbers are normalized, common carriers are detected conservatively, events are deduplicated, and provider-specific statuses are mapped into a small vocabulary. If no live tracking aggregator is configured, Sage says so and remains in manual mode rather than inventing carrier scans.

## How much should I be trusting AI?

The name Sage suggests intelligence, but one of the most important decisions was defining where AI should not be trusted.

The daily brief can summarize the work needing attention, and a future configured model can help review discoveries or suggest classifications. However, the system has a deterministic fallback for the brief, and malformed model output is rejected. AI output does not directly change financial records.

This is a pattern I want to use in more projects. Language models are valuable where the input is messy and the output is advisory. They are much less attractive as an invisible authority changing cost basis, revenue, or tax categories. In Sage, automation creates suggestions; the user accepts decisions; deterministic services apply them; and the database preserves what happened.

## Building Sage With Codex

Sage was also an experiment in building a complete, personal application with Codex. I began with a detailed product handoff rather than a list of pages. It described the daily questions, the data that had to remain auditable, the integrations, the deployment target, and two earlier projects whose proven patterns could be reused.

From there, Codex inspected the existing code, compared architectural options, wrote an implementation plan, and built the application component by component. The important part was not asking an agent to “make an ecommerce dashboard.” It was giving it the constraints that should survive every implementation choice: imports must be idempotent, missing money must not become zero, accepted suggestions must be reversible, and recovery must be testable.

The plan became a shared checklist. Each major area had an expected behavior and a verification step. Tests covered migrations, authentication, background jobs, eBay and PayPal mapping, package rules, inventory allocation, order profit, Gmail parsing, reporting, and backup restoration. The finished MVP contains 46 unit and integration tests across 16 test files, in addition to a production TypeScript and Vite build and Docker smoke testing.

Codex made it possible to move across the whole stack quickly, but the project still reinforced an old software lesson: speed is only useful if the definitions are precise. The better I explained the invariants and tradeoffs, the better the resulting code became.

## Backups Are Part of the Product

A financial-record application is not complete when it can save data. It is complete when the data can be restored.

Sage creates a consistent SQLite snapshot, copies receipt attachments, calculates checksums, writes a versioned manifest, and packages the result into a compressed archive. Restore rejects path traversal, unexpected files, checksum mismatches, unsupported schema versions, and an occupied destination unless replacement is explicitly requested.

The database and attachments are only half of the recovery set. OAuth tokens are encrypted with a separate `SAGE_ENCRYPTION_KEY`, and the key is deliberately excluded from backups. Recovering Sage therefore requires both the data archive and the encryption key. That rule is documented because a backup that cannot decrypt its credentials is only a partial recovery.

## What I Learned

To the day, Sage has saved me dozens of hours. Sometimes a chat-form assistant is the most helpful, but sometimes the best assistant is just a system that remembers context, points to exceptions, refuses to fabricate certainty, and lets every important decision be inspected and reversed. 

I also learned that a small personal application can justify serious engineering in exactly the places where trust matters. A single-user tool may not need Kubernetes, but it still benefits from idempotent imports, strict account boundaries, durable jobs, encrypted credentials, audit history, and a backup that has actually been tested. 

Most of all, Sage is an example of why I built my home server in the first place. I wanted a place where useful personal software could live continuously, close to my own data and under my control. Sage turns that infrastructure from an experiment into something practical: a quiet operator in the background, keeping the messy parts of ecommerce from disappearing between tabs.

Sage is my first micro-app, a new trend given the accesiblity of building full stack apps. Building it has been such an educational journey which has taught me how to produce alongside agents, not just consuming agentic output. I'm very inspired to create more personal software in the future!

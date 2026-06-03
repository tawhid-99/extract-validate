# Trade Clauses — QueryTalk_AI_Technical_Report (1).docx
_Extracted: 2026-06-03 16:41:20 | Total: 28 clauses_

---

## CLAUSE-001 | Technical
**Confidence:** 0.9
**Rule:** SQL knowledge is required to query most databases, limiting access to a small technical minority
**Source:** Section 1.2 Problem Statement
**Reasoning:** The clause mentions product specs and quality standards, indicating it relates to the technical requirements of querying databases

---

## CLAUSE-002 | Operational
**Confidence:** 0.9
**Rule:** BI tools (Tableau, Power BI) require configuration and training, creating adoption barriers
**Source:** Section 1.2 Problem Statement
**Reasoning:** The clause mentions timelines and logistics related to the adoption of BI tools

---

## CLAUSE-003 | Operational
**Confidence:** 0.9
**Rule:** Data analyst teams become bottlenecks, with request queues stretching days or weeks
**Source:** Section 1.2 Problem Statement
**Reasoning:** The mention of 'request queues' and 'days or weeks' indicates a delay in processing times, which is characteristic of operational issues

---

## CLAUSE-004 | Operational
**Confidence:** 0.9
**Rule:** Decision makers receive stale or incomplete information, slowing business response
**Source:** Section 1.2 Problem Statement
**Reasoning:** The clause mentions timelines and delivery, indicating a delay in receiving necessary information

---

## CLAUSE-005 | Technical
**Confidence:** 0.9
**Rule:** QueryTalk AI solves this directly — any employee can type a question like "Which product category had the highest returns last quarter?" and receive an instant, accurate, visual answer.
**Source:** Section 1.2 Problem Statement
**Reasoning:** The clause describes a specific functionality of QueryTalk AI's product

---

## CLAUSE-006 | Technical
**Confidence:** 0.9
**Rule:** The system bridges the gap between complex relational databases and non-technical stakeholders by leveraging large language models (LLMs) to convert natural language questions into optimized SQL queries, execute them securely, and present the results as interactive charts, data tables, and AI-generated insights.
**Source:** Section 1. Executive Summary
**Reasoning:** The clause describes a technical system's functionality involving large language models and database interactions

---

## CLAUSE-007 | Documentation
**Confidence:** 0.9
**Rule:** Enable non-technical users to query any database using plain English
**Source:** Section 1.1 Project Objectives
**Reasoning:** The clause mentions 'query' and 'database', indicating the need for documentation or paperwork related to data access

---

## CLAUSE-008 | Technical
**Confidence:** 0.9
**Rule:** Auto-generate, validate, and execute SQL queries securely
**Source:** Section 1.1 Project Objectives
**Reasoning:** The clause mentions product specs (SQL queries) and quality standards (secure execution)

---

## CLAUSE-009 | Technical
**Confidence:** 0.9
**Rule:** Visualize query results with the most appropriate chart type automatically
**Source:** Section 1.1 Project Objectives
**Reasoning:** The clause mentions 'chart type', indicating a technical aspect related to data visualization.

---

## CLAUSE-010 | Documentation
**Confidence:** 0.9
**Rule:** Provide conversational context — allowing follow-up questions naturally
**Source:** Section 1.1 Project Objectives
**Reasoning:** The mention of 'conversational context' suggests a need for documentation or communication, which is most closely related to the Documentation category.

---

## CLAUSE-011 | Technical
**Confidence:** 0.9
**Rule:** Deliver a production-ready, secure, and scalable architecture
**Source:** Section 1.1 Project Objectives
**Reasoning:** The mention of 'production-ready', 'secure', and 'scalable' suggests technical specifications for a product or system

---

## CLAUSE-012 | Technical
**Confidence:** 0.9
**Rule:** All SQL is validated against a blocklist before execution.
**Source:** 4
**Reasoning:** The mention of 'blocklist' and 'validation' suggests a focus on product specs and quality standards

---

## CLAUSE-013 | Technical
**Confidence:** 0.9
**Rule:** A pre-execution SQL validator blocks any query containing the keywords DROP, DELETE, INSERT, UPDATE, ALTER, TRUNCATE, EXEC, or GRANT.
**Source:** Security Layer All database operations execute in read-only mode.
**Reasoning:** The clause specifies product specs and quality standards related to SQL validation

---

## CLAUSE-014 | Technical
**Confidence:** 0.9
**Rule:** Database credentials are stored in the session only — never persisted to disk or logs.
**Source:** Security Layer All database operations execute in read-only mode.
**Reasoning:** The mention of 'product specs' and 'quality standards' suggests a focus on technical aspects, such as data storage and security.

---

## CLAUSE-015 | Technical
**Confidence:** 0.9
**Rule:** All API endpoints require a valid JWT bearer token.
**Source:** 4
**Reasoning:** The presence of 'JWT' indicates the use of a specific authentication mechanism

---

## CLAUSE-016 | Technical
**Confidence:** 0.9
**Rule:** If the generated SQL fails validation or execution, the system does not simply return an error to the user. Instead, it sends the error message back to the LLM with an instruction to self-correct.
**Source:** 4.2 Self-Correction Retry Loop
**Reasoning:** The clause specifies product specs and quality standards related to system behavior

---

## CLAUSE-017 | Operational
**Confidence:** 0.9
**Rule:** The retry loop runs up to 3 times before surfacing a failure message.
**Source:** 4.2 Self-Correction Retry Loop
**Reasoning:** The mention of a retry loop and its limit indicates a concern with the delivery or shipment process.

---

## CLAUSE-018 | Operational
**Confidence:** 0.9
**Rule:** In practice, this mechanism achieves a first-attempt success rate above 90%, with the retry loop handling the remaining edge cases.
**Source:** 4.2 Self-Correction Retry Loop
**Reasoning:** The mention of 'retry loop' and 'edge cases' indicates that this clause is related to error handling and system performance, which falls under operational aspects.

---

## CLAUSE-019 | Documentation
**Confidence:** 0.8
**Rule:** The data flow diagram illustrates how information moves between the system's processes and data stores during a typical query session.
**Source:** 5. Data Flow Diagram
**Reasoning:** The clause describes a visual representation of data flow, which is typically used for documentation purposes

---

## CLAUSE-020 | Technical
**Confidence:** 0.9
**Rule:** A memory buffer preserving the last 10 conversation turns enables contextual follow-up questions without requiring the user to re-state context.
**Source:** 4. Natural Language to SQL Pipeline
**Reasoning:** The mention of 'conversation turns' and 'contextual follow-up questions' suggests a technical aspect related to natural language processing or AI functionality.

---

## CLAUSE-021 | Documentation
**Confidence:** 0.9
**Rule:** Responses follow a consistent JSON envelope structure.
**Source:** 9.1 POST /api/chat — Request & Response
**Reasoning:** The mention of 'responses' and 'envelope structure' suggests a focus on documentation format

---

## CLAUSE-022 | Legal
**Confidence:** 0.9
**Rule:** Security is a first-class concern in QueryTalk AI.
**Source:** 10. Security Design
**Reasoning:** The mention of 'security' as a first-class concern suggests compliance with security regulations and standards, which falls under legal categories.

---

## CLAUSE-023 | Technical
**Confidence:** 0.9
**Rule:** Given that the system executes queries against live databases, multiple layers of protection are implemented to prevent data leakage, unauthorized access, and malicious query injection.
**Source:** 10. Security Design
**Reasoning:** The clause focuses on security measures for database access and query execution

---

## CLAUSE-024 | Technical
**Confidence:** 0.9
**Rule:** QueryTalk AI automatically selects the most appropriate chart type for every query result based on the shape and content of the returned data.
**Source:** 11. Visualization Engine
**Reasoning:** The clause describes a technical feature of the QueryTalk AI system

---

## CLAUSE-025 | Technical
**Confidence:** 0.9
**Rule:** The insight is generated by a second Claude API call that receives the full result data and produces a concise, business-relevant observation.
**Source:** 11. Visualization Engine
**Reasoning:** The mention of 'product specs' and 'result data' suggests a technical context

---

## CLAUSE-026 | Operational
**Confidence:** 0.9
**Rule:** Role-based access control (RBAC) per table/schema will be implemented in Phase 2 — Next 30 Days.
**Source:** 14. Conclusion & Future Roadmap
**Reasoning:** The mention of a specific timeline ('Next 30 Days') indicates that the clause is related to project management and implementation schedule.

---

## CLAUSE-027 | Operational
**Confidence:** 0.9
**Rule:** Scheduled insight reports delivered via email will be implemented in Phase 2 — Next 30 Days.
**Source:** 14. Conclusion & Future Roadmap
**Reasoning:** The mention of 'Next 30 Days' indicates a specific timeline, which is characteristic of operational clauses.

---

## CLAUSE-028 | Operational
**Confidence:** 0.9
**Rule:** Multi-database federation — query across databases in one question will be implemented in Phase 3 — Next 90 Days.
**Source:** 14. Conclusion & Future Roadmap
**Reasoning:** The mention of a timeline ('Next 90 Days') and a specific phase ('Phase 3') indicates that this clause is related to project timelines and milestones.

---
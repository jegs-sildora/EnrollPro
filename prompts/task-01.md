# Prompt for Full-Stack Implementation: Automated Term Rollover & Date Mocking

## Role & Context
Act as a Full-Stack Developer. We are refactoring the `System Configuration` module, specifically the `Term Dates` configuration card. 

Currently, the system relies on manual intervention via "SET AS ACTIVE TERM" buttons to transition between academic periods. We are migrating to a fully automated, clock-driven architecture. The backend must automatically compute and broadcast the `ACTIVE` term to the entire application based strictly on the current date of the `Asia/Manila` server clock and the dates configured in this UI.

## Critical Directive
All date/time evaluations must strictly use the `Asia/Manila` (PHT) timezone, regardless of the physical location of the server or the client's browser. Furthermore, you must write a robust test suite utilizing Date Mocking to prove the automated rollover executes precisely at midnight on the boundary dates.

## 1. UI Component Refactor (The Frontend)

Remove the manual controls to prevent human error and user confusion.

*   **Remove Action Buttons:** Delete all `SET AS ACTIVE TERM` buttons from the UI. 
*   **Dynamic Status Badges:** The UI must now dynamically render a single status badge next to each term based on the backend's computed state:
    *   If `current_date < start_date`: Render a gray `UPCOMING` badge.
    *   If `current_date >= start_date && current_date <= end_date`: Render the green `ACTIVE` badge. Apply the existing green border highlight to this term's container.
    *   If `current_date > end_date`: Render a muted `COMPLETED` badge.
*   **Date Input Validation:** 
    *   Ensure the `start_date` of Term 2 cannot be earlier than the `end_date` of Term 1.
    *   Disable the date picker inputs for any term that is already `COMPLETED`. 

## 2. Backend Controller & Automation Logic

You have two architectural choices for this automation. Implement the one that best fits our stack:

*   **Option A: Lazy Evaluation (Middleware / Service Layer) - *Recommended***
    *   Instead of a scheduled cron job, intercept the global application state request (e.g., `/api/config/current-term`).
    *   On fetch, the server queries the `academic_terms` table, compares the `Asia/Manila` `now()` against the date ranges, and dynamically returns the active term. 
    *   This guarantees 100% accuracy without relying on a cron daemon.
*   **Option B: Cron Job (Scheduled Task)**
    *   Write a daily scheduled task that runs exactly at `00:01 AM Asia/Manila`.
    *   The task queries the database, identifies if today matches a new term's `start_date`, updates an `is_active` boolean column, and flushes the application cache.

## 3. Software Testing & Date Mocking Requirements

You must prove this logic works using a testing framework (e.g., Jest/Vitest for Node, PHPUnit for Laravel, or PyTest for Python) before merging. 

Write a test suite that utilizes **Date Mocking** (e.g., `sinon.useFakeTimers()` in JS, or `Carbon::setTestNow()` in PHP) to simulate time travel.

**Required Test Cases:**
1.  **The Pre-Rollover State:** Mock the system clock to `September 15, 2026, 23:59:59 PHT`. Assert that the API returns `Term 1` as the active term.
2.  **The Midnight Rollover Trigger:** Advance the mocked clock by exactly 2 seconds to `September 16, 2026, 00:00:01 PHT`. Assert that the API instantly shifts and returns `Term 2` as the active term.
3.  **The Gap Day Handling:** If Term 2 ends on Dec 18, and Term 3 starts on Jan 4, mock the clock to `December 25`. The API must return a safe fallback state (e.g., `SEMESTRAL BREAK` or maintain the previous term's `is_active` state but set an `is_grading_locked` flag to true).
4.  **Timezone Immunity:** Mock the server's local environment timezone to `UTC` or `America/New_York`. Assert that the rollover still perfectly aligns with midnight in `Asia/Manila`.
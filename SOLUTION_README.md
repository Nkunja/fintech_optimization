SOLUTION:

## The Core Problem
The current implementation builds massive, nested Prisma queries at runtime with:
    - Complex OR conditions across different offer types
    - Array membership checks on eligibleCustomerTypes
    - Multiple joins and nested some clauses
    - Date range and budget validations

This happens on every request, which cannot at all scale.

## My Recommended Approach
My approach is moving computation from query-time to write-time. I'd recommend a materialized eligibility table approach:
Strategy: Pre-computed Eligibility
Create a UserOfferEligibility table that stores which users that are eligible for which offers, updated when:

    - Offers change (created/updated/deleted)
    - User customer types change
    - Budgets are exhausted
    - Date ranges expire

This converts the complex runtime query into a simple lookup.
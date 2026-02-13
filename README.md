# Solution - This is my approach 

# The problem identified from the existing code

The current implementation is using a massive, nested Prisma query at runtime for every request:

These include: 
- Complex `OR` conditions across Cashback, Exclusive, and Loyalty offer types
- Array membership checks on `eligibleCustomerTypes` per merchant
- Multiple joins, nested `some` clauses, and customer-type hierarchy for loyalty
- Date-range and budget validations in the same query

This happens everytime `offers` / `loyaltyPrograms` requests are made and will definitely cause a server strain as requests increase over time. That means with an increasse in users/outlets or offers the system cannot scale does not scale.


# My approach - This is my suggested approach as implemented in this code. I have moved computation from query-time to write-time to make sure multiple query requests do not call multiple db calls

I have Introduced a `UserOfferEligibility` table that stores which users are eligible for which offers and I keep it updated when:

  - Offers change (created / updated / deleted / activated / deactivated)
  - User customer types change
  - Budgets are exhausted or date ranges expire

The runtime offers and loyaltyPrograms resolvers then do a simple lookup on this table instead of recomputing eligibility on every request.

This is the advantage of doing this;  

We now have services and queues running in the background to check for changes and uodate the offerEligibility table;

Also at the point of creation or change (offers/user), a function is called that uodates the UserEligibility table;

This makes sure that at the point at which a user is making their queries(from the web/ mobile app or maybe the API), all we do is read the eligibility and proceed with the implementation.

Reduction in db reads and conditions on db query makes user requests more lightweight and optimize performance as well as response time, this is because the heavy multi-join query has now been turned to an index filter on one table. This can be optimized further by caching


# Running app Locally

```bash
npx prisma generate
npx prisma migrate dev
npm run seed-merchants    
npm run load-users        
npm run seed-offers       
```

Optional:

- `npm run simulate-transactions` – bumps used budgets / points to simulate usage  


```bash
npm run build
npm start
#  GraphQL Playground: http://localhost:5050/graphql - port can be changed in .env
```

Use `X-Test-User-Id: user-dev-001` (or another test user) in HTTP headers when calling `offers` / `loyaltyPrograms`.


To run test cases:
`npm test`

These test cases get offers tied to a user, test the flow for a user getting all eligibility for cashback computed and responses given


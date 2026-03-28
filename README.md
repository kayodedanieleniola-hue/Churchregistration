# Churchregistration

Churchregistration is a Flask-based church membership registration application built for Global Harvest Outer Ringroad. It is designed to collect member information through a guided public registration flow, capture or upload member photos, and generate recoverable membership ID cards.

The system stores registration records in Supabase and saves member photos in a Supabase Storage bucket, giving the project durable hosted storage while keeping the same public registration flow and protected admin tools. Church staff can review registrations, monitor activity, export records as CSV, and recover member ID cards whenever needed.

The application is structured to keep church data recoverable and deployment-friendly. Instead of depending on local server files, it uses hosted database and object storage services so registrations and photos can survive restarts, redeployments, and platform changes.

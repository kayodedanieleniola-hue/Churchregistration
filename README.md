# Churchregistration

Churchregistration is a Flask-based church membership registration application built for Global Harvest Outer Ringroad. It is designed to collect member information through a guided public registration flow, capture or upload member photos, and generate recoverable membership ID cards.

The system stores registration records in a CSV file and saves member photos as JPG files, making the project lightweight and easy to manage without a traditional database. It also includes a protected admin dashboard where church staff can review registrations, monitor activity, download the CSV record file, and recover member ID cards whenever needed.

The application was structured to keep church data accessible and portable. Instead of tying records to a database server, it keeps membership data in simple file-based storage so registrations, photos, and backup records can be retained and moved easily as the project grows.

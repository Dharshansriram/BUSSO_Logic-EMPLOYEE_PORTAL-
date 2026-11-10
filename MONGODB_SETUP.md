# IntelliFlow MongoDB setup

IntelliFlow now uses **MongoDB with Mongoose**. Drizzle, MySQL, and the unused starter UI dependency tree have been removed from the active application.

## Environment

Create a `.env` file in the project root:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/intelliflow
JWT_SECRET=replace-with-a-long-random-secret
```

For MongoDB Atlas, use the connection string supplied by Atlas instead:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/intelliflow
```

Mongoose creates the collections automatically when the server first connects and seeds the demo workspace when the database is empty. No SQL migration command is required.

## Commands

```bash
pnpm install
pnpm dev
```

The application keeps a safe in-memory demo fallback when `MONGODB_URI` is not configured, but employee, task, schedule, notification, and invitation changes will not persist until MongoDB is connected.

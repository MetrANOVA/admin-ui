# admin-ui

MetrANOVA Admin UI

## Setup

- Create a virtualenv, activate it, and install dependencies

**Note:** Use Node v22 or above (see `.nvmrc`) — the CSS build tooling requires it. If you use `nvm`, run `nvm use` in the repo root to switch automatically.

```bash
python3 -m venv venv
source venv/bin/activate
nvm use
make install
```

- Set up formatting/linting pre-commit hooks

```bash
pre-commit install
```

## Running the app

The API and frontend run as two separate servers, each in its own shell.

### Step One: Start the API

```bash
make run-api
```

FastAPI will be running at `http://localhost:8000`.

### Step Two: Start the frontend

The frontend is plain HTML/HTMX, styled with Tailwind + the Packets design system, served by a small Python static server.

```bash
make run-frontend
```

You should be able to see the app at `http://localhost:5001`.

### CSS builds

While making style changes, run this in a separate shell to rebuild `output.css` automatically:

```bash
make css-watch
```

Or build it once with `make css-build`.

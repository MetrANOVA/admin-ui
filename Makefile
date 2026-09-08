.PHONY: run-api run-frontend css-build css-watch install

install:
	pip3 install -r requirements.txt
	npm install

run-api:
	@echo "Starting API on http://localhost:8000"
	python3 -m uvicorn adminui.api.main:app --reload --port 8000

run-frontend:
	@echo "Starting frontend on http://localhost:5001"
	cd adminui/frontend && python3 server.py --port=5001

css-build:
	npm run css-build

css-watch:
	npm run css-watch

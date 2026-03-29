# Ansible utilities

This folder contains a simple local Ansible workflow for seeding the current `backend/chat-service` stack.

## What gets seeded

Because `chat-service` currently stores chat history in memory, there isn't a persistent database to seed yet.

Instead, this playbook seeds the live backing brokers the service already uses:

- Redis server channel: `chat:server`
- Kafka topic: `messages`

This is useful for:

- generating sample traffic
- testing observability dashboards
- validating Redis/Kafka fan-out
- checking message lag and failure counters

## Files

- `inventory.ini` — local inventory
- `group_vars/all.yml` — container names and paths
- `seed-data/chat-seed.json` — sample messages
- `seed-chat-service.yml` — main playbook

## Prerequisites

- Docker running
- The `backend/chat-service` compose stack running
- Ansible installed locally

## Run

From the repo root:

```bash
ansible-playbook -i ansible/inventory.ini ansible/seed-chat-service.yml
```

## Notes

- If your Docker Compose project names differ, update `ansible/group_vars/all.yml`.
- If you later move chat history into Postgres or DynamoDB, this playbook can be extended to seed the actual persistence layer too.
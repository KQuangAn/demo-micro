**Event Sourcing**: Think of a bank account. You can't simply store the current balance. Instead, you must store the records (or the **events**) that have led up to the current balance (or the **state**). The events (`deposited 100 dollars`, `withdrawn 50 dollars`, etc.) are the source of truth. The state (the current balance) is just derived from the events.

**CQRS**: It means Command Query Responsibility Segregation. All those words... it must be a pretty hard concept, doesn't it? Nah, it just means that the part of your system that's responsible for writing data will be separated from the part that's in charge of reading data. So when you write data, you'll be writing events, but when you need to read data, you'll read projections (the data derived from the events). For example, whenever you call the `deposit({ to: 'john', amount: 100 })` command, a `deposited 100 dollars to John's account` event will be recorded. In the background, that will trigger a function (a projection handler) that will update the `balance` of John's account in the `accounts` collection. Did you see it? You wrote to the `events` collection, but you'll read from the `accounts` collection.

**DDD**: It means Domain-Driven Design. It's a hard way to say you'll mostly name things in your code exactly how other non-tech people name them. Domain -> application -> infra -> framework

Domain layer
Holds the core business rules and models; this is where business decisions live and must remain independent of frameworks or databases.

Application layer
Defines use cases and execution flow; it coordinates domain objects and calls out to repositories or services without implementing technical details.

Infrastructure layer
Contains concrete technical implementations like database access, APIs, messaging, and external integrations.

Presentation layer
Translates user or API input into application commands and formats application output for the client (UI, HTTP, GraphQL, etc.).

**Domain-Driven Design** (DDD) is particularly useful in the following scenarios:

**_Complex Business Domains_**: When the business logic is intricate, with numerous rules and interactions, DDD helps to encapsulate and model these complexities effectively.

Frequent Changes in Requirements: In environments where business needs evolve rapidly, DDD allows for more flexible and adaptive designs, making it easier to accommodate change.

Collaboration with Domain Experts: If your team includes domain experts, DDD fosters a shared understanding through a common language, improving communication and reducing misunderstandings.

Microservices Architecture: When building a system with microservices, DDD's concepts of bounded contexts help to define clear boundaries and responsibilities for each service.

Long-Lived Systems: For systems expected to endure over time, DDD promotes a robust architecture that can adapt to changing requirements while maintaining a clean design.

Regulatory Compliance: In domains with strict compliance requirements, DDD helps ensure that the system accurately reflects and adheres to business rules and regulations.

Large Development Teams: In projects involving multiple teams, DDD can help manage complexity by dividing the system into well-defined domains and subdomains, facilitating parallel development.

domain = core entity

# Domain Layer: User Model

class User:
def **init**(self, id: int, username: str, email: str):
self.id = id
self.username = username
self.email = email

application = use cases , flow of execution

# Application Layer: User Service

class UserService:
def **init**(self, user_repository):
self.user_repository = user_repository

    def create_user(self, username: str, email: str):
        new_user = User(id=self.generate_id(), username=username, email=email)
        self.user_repository.add(new_user)

infra = actual implementation

# Infrastructure Layer: User Repository Implementation

class InMemoryUserRepository:
def **init**(self):
self.users = {}

    def add(self, user: User):
        self.users[user.id] = user

    def get_by_id(self, user_id: int) -> User:
        return self.users.get(user_id, None)

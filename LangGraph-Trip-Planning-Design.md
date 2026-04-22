# LangGraph Multi-Agent System Design: Trip Planning Assistant

## Overview
You are tasked with designing four distinct multi-agent systems in LangGraph from scratch, each based on a different workflow architecture:

1. **Sequential workflow**
2. **Parallel workflow**
3. **Subagents-as-tools workflow**
4. **Critic loop workflow**

**Domain:** Trip Planning Assistant
- The system should plan itineraries, find hotels, recommend food places, and adapt plans based on user preferences.
- The system must first understand user preferences (budget, travel style, dietary restrictions, etc.) before generating or updating plans.

---



## YAML & TypeScript Structure
- **Nodes** are declared in YAML:
  ```yaml
  id: <uniqueNodeId>
  type: AgentNode
  prompt?: "system prompt"
  ```
- **Edges** are declared in a separate TypeScript file (`edges.ts`).
  - For simple routing:
    ```ts
    export const edges = [
      ["node1", "node2"],
      ["node2", "node3"]
    ];
    ```
  - For conditional routing:
    ```ts
    export const edges = [
      ["nodeA", "nodeB", { condition: "if user has dietary restrictions" }],
      ["nodeC", "nodeD", { condition: "if budget < threshold" }]
    ];
    ```

This allows for both straightforward and dynamic, condition-based agent transitions, with conditional logic managed in `edges.ts`.

---


## Requirements
1. Follow Test-Driven Development (TDD) and Contract-Driven Development (CDD). Begin by defining evaluation criteria and tests before implementation.
2. Create reusable functions that can parse the YAML files and automatically build the corresponding LangGraph components (nodes, edges, graphs).
3. Include all necessary middleware by creating before/after nodes that handle:
  - Validate PII in user input
  - Validate tool calls before and after execution
  - Add tool retry logic in state
  - Maintain todo lists in state
  - Allow human-in-the-loop interrupts
4. Integrate a **Postgres checkpointer** for persistence and recovery of agent state across workflows.
5. For each workflow, generate a YAML file that declaratively defines all nodes, and an `edges.ts` file that defines all edges (including conditional edges and middleware nodes).
6. Ensure modularity so that components (e.g., hotel finder, food recommender, itinerary planner, preference analyzer) can be reused or extended across workflows.
7. Provide clear documentation and rationale for design choices.

---


## Deliverables
- Evaluation definitions/tests for each workflow (e.g., correctness of itinerary, preference alignment, diversity of food options).
- Reusable function library for nodes, edges, and graphs that can read YAML and instantiate LangGraph components.
- Node definitions in `node.ts` and edge definitions in `edges.ts`, including conditional logic.
- Four YAML files (one per workflow) defining the system declaratively, including middleware nodes and Postgres checkpointer integration.
- Explanations of how each workflow differs in agent interaction and system behavior.
## Postgres Checkpointer Integration

All workflows must integrate a Postgres checkpointer node to ensure persistence and recovery of agent state. This node should be included in the YAML and workflow definitions, and referenced in the middleware chain. The checkpointer ensures that, at key points in the workflow, the current state is saved to and can be restored from a Postgres database, supporting robustness and fault tolerance.

---

## Evaluation Criteria & Example Tests

- **Preferences Alignment:** Plans must respect user budget, travel style, and dietary restrictions.
- **Itinerary Correctness:** All days are planned, no time conflicts, logical order.
- **Hotel Suitability:** Hotels match location, budget, and preference constraints.
- **Food Diversity:** Recommendations are varied and respect dietary needs.
- **Adaptivity:** System updates plans when user preferences change.

**Example Test Cases (pseudo-code):**
```python
def test_preferences_alignment(plan, user_prefs):
    assert plan.budget <= user_prefs.budget
    assert all(item in plan.activities for item in user_prefs.interests)
    assert all(food['type'] not in user_prefs.dietary_restrictions for food in plan.food_options)

def test_itinerary_correctness(plan):
    assert len(plan.days) == user_prefs.trip_length
    assert not has_time_conflicts(plan.days)
    assert is_logical_order(plan.days)

def test_hotel_suitability(hotels, user_prefs):
    for hotel in hotels:
        assert hotel['price'] <= user_prefs.budget
        assert hotel['location'] in user_prefs.destinations

def test_food_diversity(food_options):
    types = set(food['cuisine'] for food in food_options)
    assert len(types) >= 3  # At least 3 different cuisines

def test_adaptivity(plan, updated_prefs):
    updated_plan = update_plan(plan, updated_prefs)
    assert test_preferences_alignment(updated_plan, updated_prefs)
```

---

## Reusable Function Library (Pseudo-API)

```python
def create_node(id, type, prompt=None):
    return {"id": id, "type": type, "prompt": prompt}

def create_edge(source, target):
    return [source, target]

def parse_yaml_to_graph(yaml_file):
    # Parses YAML and instantiates LangGraph components
    ...
```
- These functions can be used to generate and parse YAML for all workflows.

---

## Middleware Nodes (Reusable)
- **PIIValidatorBefore**: Validates PII in user input.
- **ToolCallValidatorBefore**: Validates tool calls before execution.
- **ToolCallValidatorAfter**: Validates tool calls after execution.
- **ToolRetryManager**: Adds retry logic for failed tool calls.
- **TodoListManager**: Maintains todo lists in state.
- **HumanInterruptManager**: Allows human-in-the-loop interrupts.

These nodes are included in all workflows for compliance and robustness.

---

## Workflow YAML Examples

### 1. Sequential Workflow
```yaml
description: Sequential Trip Planning Workflow
nodes:
  - id: PIIValidatorBefore
    type: MiddlewareNode
  - id: PreferenceAnalyzer
    type: AgentNode
    prompt: "Extract user preferences (budget, style, dietary, etc.)"
  - id: ItineraryPlanner
    type: AgentNode
    prompt: "Plan daily itinerary based on preferences"
  - id: HotelFinder
    type: AgentNode
    prompt: "Find hotels matching itinerary and preferences"
  - id: FoodRecommender
    type: AgentNode
    prompt: "Recommend diverse food options respecting dietary needs"
  - id: ToolCallValidatorAfter
    type: MiddlewareNode
  - id: ToolRetryManager
    type: MiddlewareNode
  - id: TodoListManager
    type: MiddlewareNode
  - id: HumanInterruptManager
    type: MiddlewareNode
edges:
  - [PIIValidatorBefore, PreferenceAnalyzer]
  - [PreferenceAnalyzer, ItineraryPlanner]
  - [ItineraryPlanner, HotelFinder]
  - [HotelFinder, FoodRecommender]
  - [FoodRecommender, ToolCallValidatorAfter]
  - [ToolCallValidatorAfter, ToolRetryManager]
  - [ToolRetryManager, TodoListManager]
  - [TodoListManager, HumanInterruptManager]
```

### 2. Parallel Workflow
```yaml
description: Parallel Trip Planning Workflow
nodes:
  - id: PIIValidatorBefore
    type: MiddlewareNode
  - id: PreferenceAnalyzer
    type: AgentNode
    prompt: "Extract user preferences"
  - id: ItineraryPlanner
    type: AgentNode
    prompt: "Plan itinerary"
  - id: HotelFinder
    type: AgentNode
    prompt: "Find hotels"
  - id: FoodRecommender
    type: AgentNode
    prompt: "Recommend food"
  - id: ResultMerger
    type: AgentNode
    prompt: "Merge itinerary, hotels, and food into final plan"
  - id: ToolCallValidatorAfter
    type: MiddlewareNode
  - id: ToolRetryManager
    type: MiddlewareNode
  - id: TodoListManager
    type: MiddlewareNode
  - id: HumanInterruptManager
    type: MiddlewareNode
edges:
  - [PIIValidatorBefore, PreferenceAnalyzer]
  - [PreferenceAnalyzer, ItineraryPlanner]
  - [PreferenceAnalyzer, HotelFinder]
  - [PreferenceAnalyzer, FoodRecommender]
  - [ItineraryPlanner, ResultMerger]
  - [HotelFinder, ResultMerger]
  - [FoodRecommender, ResultMerger]
  - [ResultMerger, ToolCallValidatorAfter]
  - [ToolCallValidatorAfter, ToolRetryManager]
  - [ToolRetryManager, TodoListManager]
  - [TodoListManager, HumanInterruptManager]
```

### 3. Subagents-as-Tools Workflow
```yaml
description: Subagents-as-Tools Trip Planning Workflow
nodes:
  - id: PIIValidatorBefore
    type: MiddlewareNode
  - id: PreferenceAnalyzer
    type: AgentNode
    prompt: "Extract preferences"
  - id: Planner
    type: AgentNode
    prompt: "Main orchestrator; calls subagents as tools"
  - id: HotelFinder
    type: AgentNode
    prompt: "Find hotels"
  - id: FoodRecommender
    type: AgentNode
    prompt: "Recommend food"
  - id: ToolCallValidatorBefore
    type: MiddlewareNode
  - id: ToolCallValidatorAfter
    type: MiddlewareNode
  - id: ToolRetryManager
    type: MiddlewareNode
  - id: TodoListManager
    type: MiddlewareNode
  - id: HumanInterruptManager
    type: MiddlewareNode
edges:
  - [PIIValidatorBefore, PreferenceAnalyzer]
  - [PreferenceAnalyzer, Planner]
  - [Planner, ToolCallValidatorBefore]
  - [ToolCallValidatorBefore, HotelFinder]
  - [ToolCallValidatorBefore, FoodRecommender]
  - [HotelFinder, ToolCallValidatorAfter]
  - [FoodRecommender, ToolCallValidatorAfter]
  - [ToolCallValidatorAfter, ToolRetryManager]
  - [ToolRetryManager, TodoListManager]
  - [TodoListManager, HumanInterruptManager]
```

### 4. Critic Loop Workflow
```yaml
description: Critic Loop Trip Planning Workflow
nodes:
  - id: PIIValidatorBefore
    type: MiddlewareNode
  - id: PreferenceAnalyzer
    type: AgentNode
    prompt: "Extract preferences"
  - id: Planner
    type: AgentNode
    prompt: "Generate plan"
  - id: Critic
    type: AgentNode
    prompt: "Review and critique plan; suggest improvements"
  - id: ToolCallValidatorAfter
    type: MiddlewareNode
  - id: ToolRetryManager
    type: MiddlewareNode
  - id: TodoListManager
    type: MiddlewareNode
  - id: HumanInterruptManager
    type: MiddlewareNode
edges:
  - [PIIValidatorBefore, PreferenceAnalyzer]
  - [PreferenceAnalyzer, Planner]
  - [Planner, Critic]
  - [Critic, Planner]  # loop if improvement needed
  - [Critic, ToolCallValidatorAfter]
  - [ToolCallValidatorAfter, ToolRetryManager]
  - [ToolRetryManager, TodoListManager]
  - [TodoListManager, HumanInterruptManager]
```

---

## Workflow Differences & Rationale
- **Sequential:** Simple, easy to debug, but slow and inflexible if user preferences change late in the pipeline.
- **Parallel:** Fast, but merging results can be complex; good for independent subtasks.
- **Subagents-as-Tools:** Flexible, modular, main agent can dynamically decide which subagents to invoke.
- **Critic Loop:** Ensures high-quality output by iterative refinement; best for complex, user-tailored plans.

**Modularity:**
All agents and middleware are defined as reusable nodes with clear contracts, so they can be recombined in any workflow.

---

## Next Steps
- Implement the reusable function library in code.
- Write the YAML files for each workflow (as above).
- Implement the test suite for evaluation criteria.
- Build each workflow using the function library and YAML definitions.

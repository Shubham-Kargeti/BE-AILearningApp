from typing import TypedDict, List
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI

# Define shared state
class AgentState(TypedDict):
    messages: List[str]
    decision: str

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

def analyze(state: AgentState):
    response = llm.invoke(
        f"Analyze this request and decide if clarification is needed:\n{state['messages'][-1]}"
    )
    return {
        "decision": "clarify" if "?" in response.content else "proceed",
        "messages": state["messages"] + [response.content]
    }

def ask_clarification(state: AgentState):
    return {
        "messages": state["messages"] + ["Can you clarify your requirement further?"]
    }

def finalize(state: AgentState):
    return {
        "messages": state["messages"] + ["Here is the final recommendation."]
    }

graph = StateGraph(AgentState)

graph.add_node("analyze", analyze)
graph.add_node("clarify", ask_clarification)
graph.add_node("finalize", finalize)

graph.set_entry_point("analyze")

graph.add_conditional_edges(
    "analyze",
    lambda state: state["decision"],
    {
        "clarify": "clarify",
        "proceed": "finalize"
    }
)

graph.add_edge("clarify", END)
graph.add_edge("finalize", END)

app = graph.compile()

result = app.invoke({"messages": ["We need an app"], "decision": ""})
print(result)

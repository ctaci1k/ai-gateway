// frontend/app/page.js

"use client";

import {
  useEffect,
  useRef,
  useState
} from "react";

export default function Home() {

  const messagesEndRef = useRef(null);

  const [message, setMessage] = useState("");

  const [response, setResponse] = useState("");

  const [structuredResponse, setStructuredResponse] = useState(null);

  const [loading, setLoading] = useState(false);

  const [provider, setProvider] = useState("groq");

  const [providers, setProviders] = useState([]);

  const [providersInfo, setProvidersInfo] = useState([]);

  const [compareViewMode, setCompareViewMode] = useState("cards");

  const [memory, setMemory] = useState([]);

  const [streamingProvider, setStreamingProvider] = useState("");

  const [streamingModel, setStreamingModel] = useState("");

  const [allResponses, setAllResponses] = useState({});

  const [selectedModel, setSelectedModel] = useState("");

  const [compareMode, setCompareMode] = useState(false);

  const [selectorEnabled, setSelectorEnabled] = useState(false);

  const [executionMetadata, setExecutionMetadata] = useState([]);

  const [selectorScores, setSelectorScores] = useState({});


  const [
    selectorMetadata,
    setSelectorMetadata
  ] = useState(null);

  const [
    selectorConfidence,
    setSelectorConfidence
  ] = useState(0);

  const [
    selectorProvider,
    setSelectorProvider
  ] = useState("");

  const [
    selectorJudgeModel,
    setSelectorJudgeModel
  ] = useState("");

  const [
    selectorFallbackUsed,
    setSelectorFallbackUsed
  ] = useState(false);
  const [
    executionSummary,
    setExecutionSummary
  ] = useState(null);

  const [selectorReason, setSelectorReason] = useState("");

  const [compareSummary, setCompareSummary] = useState(null);

  const [showAllResponses, setShowAllResponses] = useState(true);

  const [selectedResponseCard, setSelectedResponseCard] = useState(null);

  const [
    userPreferences,
    setUserPreferences
  ] = useState(null);


  useEffect(() => {

    async function loadProviders() {

      const res = await fetch(
        "http://127.0.0.1:8000/providers"
      );

      const data = await res.json();

      setProviders(data.providers);
    }

    async function loadProvidersInfo() {

      const res = await fetch(
        "http://127.0.0.1:8000/providers/info"
      );

      const data = await res.json();

      setProvidersInfo(data.providers);
    }

    async function loadMemory() {

      const res = await fetch(
        "http://127.0.0.1:8000/memory"
      );

      const data = await res.json();

      setMemory(data.memory);
    }

    loadProviders();

    loadProvidersInfo();

    loadMemory();

    loadPreferences();

  }, []);


  useEffect(() => {

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });

  }, [response]);

  async function loadMemory() {

    const res = await fetch(
      "http://127.0.0.1:8000/memory"
    );

    const data = await res.json();

    setMemory(data.memory);
  }

async function loadPreferences() {

  const res = await fetch(
    "http://127.0.0.1:8000/preferences"
  );

  const data = await res.json();

  setUserPreferences(
    data.preferences
  );
}


  async function newChat() {

    await fetch(
      "http://127.0.0.1:8000/memory",
      {
        method: "DELETE",
      }
    );

    setResponse("");

    setStructuredResponse(null);

    setMemory([]);

    setMessage("");

    setStreamingProvider("");

    setStreamingModel("");

    setAllResponses({});

    setSelectedModel("");

    setExecutionMetadata([]);

    setSelectorScores({});

    setSelectorMetadata(null);

    setExecutionSummary(null);

    setSelectorReason("");

    setCompareSummary(null);
  }


  async function sendMessage() {

    if (!message.trim()) {
      return;
    }

    setLoading(true);

    setResponse("");

    setStructuredResponse(null);

    setStreamingProvider("");

    setStreamingModel("");

    setAllResponses({});

    setSelectedModel("");

    setExecutionMetadata([]);

    setSelectorScores({});

    setSelectorMetadata(null);

    setExecutionSummary(null);

    setSelectorReason("");

    setCompareSummary(null);

    try {

      if (compareMode) {

        const res = await fetch(
          "http://127.0.0.1:8000/chat",
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({
              message: message,
              providers: providers,
              compare_mode: true,
              selector_enabled: selectorEnabled,
            }),
          }
        );

        const data = await res.json();

        setResponse(data.response);

        setSelectedModel(
          data.selected_model
        );

        setAllResponses(
          data.all_responses
        );

        setExecutionMetadata(
          data.execution_metadata || []
        );

        setSelectorScores(
          data.selector_scores || {}
        );

        setSelectorMetadata(
          data.selector_metadata || null
        );

        setSelectorConfidence(
          data.selector_metadata
            ?.selector_confidence || 0
        );

        setSelectorProvider(
          data.selector_metadata
            ?.selector_provider || ""
        );

        setSelectorJudgeModel(
          data.selector_metadata
            ?.selector_model || ""
        );

        setSelectorFallbackUsed(
          data.selector_metadata
            ?.fallback_used || false
        );

        setExecutionSummary(
          data.execution_summary || null
        );
        setSelectorReason(
          data.selector_reason || ""
        );

        setCompareSummary(
          data.compare_summary || null
        );

      } else {

        const res = await fetch(
          "http://127.0.0.1:8000/chat/stream",
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({
              message: message,
              provider: provider,
            }),
          }
        );

        const reader = res.body.getReader();

        const decoder = new TextDecoder();

        let fullResponse = "";

        let buffer = "";

        while (true) {

          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value);

          const lines = buffer.split("\n");

          buffer = lines.pop();

          for (const line of lines) {

            if (!line.trim()) {
              continue;
            }

            try {

              const event = JSON.parse(line);

              if (event.type === "token") {

                fullResponse += event.content;

                setResponse(fullResponse);

                setStreamingProvider(
                  event.provider
                );

                setStreamingModel(
                  event.model
                );
              }

              if (event.type === "error") {

                setResponse(
                  "Error: " + event.content
                );
              }

            } catch (error) {

              console.error(
                "Stream parse error:",
                error
              );
            }
          }
        }
      }

      setMessage("");

      await loadMemory();

      await loadPreferences();

    } catch (error) {

      setResponse(
        "Error: " + error.message
      );

    } finally {

      setLoading(false);
    }
  }


  async function sendStructuredMessage() {

    if (!message.trim()) {
      return;
    }

    setLoading(true);

    try {

      const res = await fetch(
        "http://127.0.0.1:8000/chat/structured",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            message: message,
            provider: provider,
          }),
        }
      );

      const data = await res.json();

      setStructuredResponse(
        data.structured_response
      );

    } catch (error) {

      setStructuredResponse({
        error: error.message
      });

    } finally {

      setLoading(false);
    }
  }


  return (

    <div className="min-h-screen bg-gray-950 text-white p-8">

      <div className="max-w-7xl mx-auto flex flex-col gap-6 pb-20">

        <h1 className="text-5xl font-bold text-center">
          AI Gateway
        </h1>

        <div className="border border-gray-800 bg-gray-900 rounded p-5">

          <h2 className="text-2xl font-bold mb-4">
            Provider
          </h2>

          <select
            className="border border-gray-600 bg-white text-black p-3 rounded w-full"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            disabled={compareMode}
          >

            {providers.map((providerName) => (

              <option
                key={providerName}
                value={providerName}
              >

                {providerName}

              </option>

            ))}

          </select>

          <div className="mt-4 flex flex-col gap-3">

            <div className="flex items-center gap-3">

              <input
                type="checkbox"
                checked={compareMode}
                onChange={() => setCompareMode(
                  !compareMode
                )}
              />

              <p className="text-sm text-gray-300">
                Compare All Models
              </p>

            </div>

            <div className="flex items-center gap-3">

              <input
                type="checkbox"
                checked={selectorEnabled}
                onChange={() => setSelectorEnabled(
                  !selectorEnabled
                )}
                disabled={!compareMode}
              />

              <p className="text-sm text-gray-300">
                Enable AI Selector
              </p>

            </div>

          </div>

        </div>

        <input
          className="border border-gray-600 p-4 w-full text-white bg-gray-900 rounded"
          type="text"
          placeholder="Write message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {

            if (e.key === "Enter" && !loading) {
              sendMessage();
            }
          }}
        />

        <div className="flex flex-wrap items-center gap-4">

          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-white text-black px-5 py-3 rounded font-bold disabled:opacity-50"
          >

            {loading ? "Loading..." : "Send"}

          </button>

          <button
            onClick={sendStructuredMessage}
            disabled={loading}
            className="bg-blue-500 text-white px-5 py-3 rounded font-bold disabled:opacity-50"
          >

            Structured Output

          </button>

          <button
            onClick={newChat}
            className="bg-red-500 text-white px-5 py-3 rounded font-bold"
          >
            New Chat
          </button>

        </div>

        <div className="border border-gray-700 p-5 rounded bg-gray-900 min-h-[260px]">

          {!compareMode && streamingProvider && (

            <div className="flex items-center justify-between mb-5 border border-gray-800 rounded p-3 bg-gray-950">

              <div>

                <p className="text-sm text-gray-400">
                  Streaming Provider
                </p>

                <p className="text-blue-400 font-bold">
                  {streamingProvider}
                </p>

              </div>

              <div className="text-right">

                <p className="text-sm text-gray-400">
                  Active Model
                </p>

                <p className="text-green-400 font-bold">
                  {streamingModel}
                </p>

              </div>

            </div>

          )}

          <div className="flex items-center justify-between mb-4">

            <h2 className="text-2xl font-bold">
              AI Response
            </h2>

            <div className="flex flex-col items-end gap-1">

              {selectedModel && (

                <div className="text-right">

                  <p className="text-green-400 font-bold">
                    Selected Model
                  </p>

                  <p className="text-sm text-gray-300">
                    {selectedModel}
                  </p>

                </div>

              )}

              {selectorEnabled && (

                <p className="text-xs text-yellow-400">
                  AI Selector Enabled
                </p>

              )}

            </div>

          </div>

          <div className="flex flex-col gap-4">

            {selectedModel && (

              <div className="flex items-center gap-3">

                <span className="bg-green-500 text-black px-3 py-1 rounded font-bold text-sm">
                  Best Response
                </span>

                <span className="text-gray-400 text-sm">
                  {selectedModel}
                </span>

              </div>

            )}

            <p className="text-gray-200 whitespace-pre-wrap leading-7">

              {response}

              {loading && !compareMode && (

                <span className="animate-pulse text-blue-400">
                  ▋
                </span>

              )}

            </p>

          </div>

          <div ref={messagesEndRef} />

        </div>

        {compareSummary && (

          <div className="border border-blue-700 bg-gray-900 rounded p-5">

            <h2 className="text-2xl font-bold text-blue-400 mb-4">
              Compare Summary
            </h2>

            <div className="grid md:grid-cols-2 gap-4">

              <div className="border border-gray-700 rounded p-4">
                <p className="text-gray-400 text-sm">
                  Successful Models
                </p>

                <p className="text-2xl font-bold text-green-400">
                  {compareSummary.successful_models}
                </p>
              </div>

              <div className="border border-gray-700 rounded p-4">
                <p className="text-gray-400 text-sm">
                  Failed Models
                </p>

                <p className="text-2xl font-bold text-red-400">
                  {compareSummary.failed_models}
                </p>
              </div>

            </div>

          </div>

        )}

        {Object.keys(allResponses).length > 0 && (

          <div className="border border-purple-700 bg-gray-900 rounded p-5 shadow-2xl">

            <div className="flex items-center justify-between mb-6">

              <div>

                <h2 className="text-3xl font-bold text-purple-400">
                  Show All Responses
                </h2>

                <p className="text-gray-400 text-sm mt-1">
                  {Object.keys(allResponses).length} models
                </p>

              </div>

              <div className="flex items-center gap-3">

                <button

                  onClick={() => setCompareViewMode(
                    "cards"
                  )}

                  className={`px-3 py-2 rounded text-sm font-bold transition ${compareViewMode === "cards"
                      ? "bg-blue-600"
                      : "bg-gray-800"
                    }`}
                >

                  Cards

                </button>

                <button

                  onClick={() => setCompareViewMode(
                    "compact"
                  )}

                  className={`px-3 py-2 rounded text-sm font-bold transition ${compareViewMode === "compact"
                      ? "bg-blue-600"
                      : "bg-gray-800"
                    }`}
                >

                  Compact

                </button>

                <button

                  onClick={() => setShowAllResponses(
                    !showAllResponses
                  )}

                  className="bg-purple-600 hover:bg-purple-500 transition px-4 py-2 rounded font-bold text-sm"
                >

                  {showAllResponses
                    ? "Hide Responses"
                    : "Show Responses"
                  }

                </button>

              </div>

            </div>
            {showAllResponses && (
              <div className="flex flex-col gap-5">

                {Object.entries(allResponses).map(
                  ([providerName, data]) => (

                    <div

                      key={providerName}

                      onClick={() => setSelectedResponseCard(
                        providerName
                      )}

                      className={`

  border rounded-xl cursor-pointer transition bg-gray-950

  ${compareViewMode === "compact"
                          ? "p-3"
                          : "p-5"
                        }
    ${selectedResponseCard === providerName
                          ? "border-blue-500"
                          : "border-gray-700 hover:border-gray-500"
                        }

  `}
                    >

                      <div className="flex items-center justify-between mb-4">

                        <div>

                          <p className="text-xl font-bold text-blue-400">
                            {providerName}
                          </p>

                          <div className="flex flex-wrap gap-2 mt-2">

                            <span className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-300">
                              {data.model}
                            </span>

                            <span className="bg-gray-800 px-2 py-1 rounded text-xs text-cyan-300">
                              {providerName}
                            </span>

                            <span className="bg-gray-800 px-2 py-1 rounded text-xs text-green-300">
                              {data.execution_time}s
                            </span>

                          </div>

                        </div>


                      </div>

                      <div className="border border-gray-800 rounded p-4 bg-gray-900/50">

                        <p className="whitespace-pre-wrap leading-8 text-gray-200 text-[15px]">
                          {data.response}
                        </p>

                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">

                        {selectedModel === providerName && (

                          <span className="bg-green-500 text-black px-3 py-1 rounded font-bold text-sm">
                            Selected Best Response
                          </span>

                        )}

                        {selectedResponseCard === providerName && (

                          <span className="bg-blue-500 text-black px-3 py-1 rounded font-bold text-sm">
                            Active Card
                          </span>

                        )}

                      </div>
                    </div>

                  ))}

              </div>
            )}
          </div>

        )}

        {compareSummary?.failed_models > 0 && (

          <div className="border border-red-700 p-5 rounded bg-gray-900">

            <h2 className="text-2xl font-bold text-red-400 mb-4">
              Failed Providers
            </h2>

            <div className="flex flex-col gap-4">

              {executionMetadata

                .filter((item) => !item.success)

                .map((item) => (

                  <div

                    key={item.provider}

                    className="border border-gray-700 rounded p-4"
                  >

                    <p className="text-red-400 font-bold">
                      {item.provider}
                    </p>

                    <p className="text-gray-400 text-sm mt-2">
                      {item.error || "Unknown error"}
                    </p>

                  </div>

                ))}

            </div>

          </div>

        )}
        {executionSummary && (

          <div className="border border-yellow-700 p-5 rounded bg-gray-900">

            <h2 className="text-3xl font-bold mb-5 text-yellow-400">
              Execution Summary
            </h2>

            <div className="grid md:grid-cols-3 gap-4">

              <div className="border border-gray-700 rounded p-4">

                <p className="text-gray-400 text-sm">
                  Total Models
                </p>

                <p className="text-2xl font-bold text-blue-400">
                  {executionSummary.total_models}
                </p>

              </div>

              <div className="border border-gray-700 rounded p-4">

                <p className="text-gray-400 text-sm">
                  Successful
                </p>

                <p className="text-2xl font-bold text-green-400">
                  {executionSummary.successful_models}
                </p>

              </div>

              <div className="border border-gray-700 rounded p-4">

                <p className="text-gray-400 text-sm">
                  Average Time
                </p>

                <p className="text-2xl font-bold text-cyan-400">
                  {executionSummary.average_execution_time}s
                </p>

              </div>

            </div>

          </div>

        )}
        {executionMetadata.length > 0 && (

          <div className="border border-cyan-700 p-5 rounded bg-gray-900">

            <h2 className="text-3xl font-bold mb-5 text-cyan-400">
              Execution Metadata
            </h2>

            <div className="flex flex-col gap-4">

              {executionMetadata.map((item) => (

                <div

                  key={item.provider}

                  className="border border-gray-700 rounded p-4 flex items-center justify-between"
                >

                  <div>

                    <p className="text-blue-400 font-bold">
                      {item.provider}
                    </p>

                    <p className="text-sm text-gray-400">
                      {item.model || "Unknown model"}
                    </p>

                  </div>

                  <div className="text-right">

                    <p className="text-green-400 font-bold">
                      {item.execution_time}s
                    </p>

                    <p className={`text-sm ${item.success
                        ? "text-green-400"
                        : "text-red-400"
                      }`}>

                      {item.success
                        ? "Success"
                        : "Failed"
                      }

                    </p>

                  </div>

                </div>

              ))}

            </div>

          </div>

        )}
        {userPreferences && (

          <div className="border border-pink-700 p-5 rounded bg-gray-900">

            <h2 className="text-3xl font-bold mb-5 text-pink-400">
              User Preferences
            </h2>

            <div className="grid md:grid-cols-3 gap-4">

              <div className="border border-gray-700 rounded p-4">

                <p className="text-gray-400 text-sm">
                  Total Messages
                </p>

                <p className="text-2xl font-bold text-blue-400">
                  {userPreferences.total_messages}
                </p>

              </div>

              <div className="border border-gray-700 rounded p-4">

                <p className="text-gray-400 text-sm">
                  Selector Usage
                </p>

                <p className="text-2xl font-bold text-yellow-400">
                  {userPreferences.selector_usage_count}
                </p>

              </div>

              <div className="border border-gray-700 rounded p-4">

                <p className="text-gray-400 text-sm">
                  Compare Usage
                </p>

                <p className="text-2xl font-bold text-green-400">
                  {userPreferences.compare_mode_usage_count}
                </p>

              </div>

            </div>

            <div className="mt-5">

              <h3 className="text-xl font-bold text-cyan-400 mb-3">
                Preferred Models
              </h3>

              <div className="flex flex-wrap gap-3">

                {Object.entries(
                  userPreferences.preferred_models || {}
                ).map(([model, count]) => (

                  <div
                    key={model}
                    className="border border-gray-700 rounded px-4 py-2 bg-gray-950"
                  >

                    <p className="text-blue-400 font-bold">
                      {model}
                    </p>

                    <p className="text-gray-400 text-sm">
                      Selected {count} times
                    </p>

                  </div>

                ))}

              </div>

            </div>

          </div>

        )}

        {selectorEnabled && Object.keys(selectorScores).length > 0 && (

          <div className="border border-green-700 p-5 rounded bg-gray-900">

            <h2 className="text-3xl font-bold mb-5 text-green-400">
              AI Selector Analysis
            </h2>

            <div className="flex flex-col gap-4">

              {Object.entries(selectorScores).map(
                ([providerName, score]) => (

                  <div
                    key={providerName}
                    className="border border-gray-700 rounded p-4 flex items-center justify-between"
                  >

                    <p className="text-blue-400 font-bold">
                      {providerName}
                    </p>

                    <div className="text-right">

                      <p className="text-green-400 font-bold">
                        Score: {score}
                      </p>


                    </div>

                  </div>

                ))}

            </div>
<div className="mb-5 border border-gray-700 rounded p-4 bg-gray-950">

  <div className="flex flex-wrap gap-3">

<div className="bg-purple-600 px-3 py-1 rounded text-sm font-bold">
  Judge: Gemini
</div>

<div className="bg-cyan-600 px-3 py-1 rounded text-sm font-bold">
  gemini-2.5-flash-lite
</div>

    <div className="bg-green-600 px-3 py-1 rounded text-sm font-bold">
      Confidence: {selectorConfidence}
    </div>

    {selectorFallbackUsed && (

      <div className="bg-red-600 px-3 py-1 rounded text-sm font-bold">
        FALLBACK USED
      </div>

    )}

  </div>

</div>
            {selectorReason && (

              <div className="mt-5 border border-gray-700 rounded p-4">

                <p className="text-yellow-400 font-bold">
                  Selector Reason
                </p>

                <p className="text-gray-300 mt-2">
                  {selectorReason}
                </p>

              </div>

            )}

          </div>

        )}

      </div>

    </div>
  );
}
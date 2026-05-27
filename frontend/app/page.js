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

  const [memory, setMemory] = useState([]);

  const [streamingProvider, setStreamingProvider] = useState("");

  const [streamingModel, setStreamingModel] = useState("");

  const [allResponses, setAllResponses] = useState({});

  const [selectedModel, setSelectedModel] = useState("");

  const [compareMode, setCompareMode] = useState(false);

  const [selectorEnabled, setSelectorEnabled] = useState(false);

  const [executionMetadata, setExecutionMetadata] = useState([]);

  const [selectorScores, setSelectorScores] = useState({});

  const [selectorReason, setSelectorReason] = useState("");


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

    setSelectorReason("");
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

    setSelectorReason("");

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
          data.execution_metadata
        );

        setSelectorScores(
          data.selector_scores || {}
        );

        setSelectorReason(
          data.selector_reason || ""
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

      <div className="max-w-7xl mx-auto flex flex-col gap-6">

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

        <div className="flex flex-wrap gap-4">

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

          <p className="text-gray-200 whitespace-pre-wrap leading-7">

            {response}

            {loading && !compareMode && (

              <span className="animate-pulse text-blue-400">
                ▋
              </span>

            )}

          </p>

          <div ref={messagesEndRef} />

        </div>

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

                  <p className="text-green-400">
                    Score: {score}
                  </p>

                </div>

              ))}

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
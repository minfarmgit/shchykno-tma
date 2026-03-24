const STORAGE_KEY = "shchykno_session_id";

function getOrCreateSessionId() {
  const existing = window.localStorage.getItem(STORAGE_KEY);

  if (existing) {
    return existing;
  }

  const nextValue = crypto.randomUUID().replace(/-/g, "");
  window.localStorage.setItem(STORAGE_KEY, nextValue);
  return nextValue;
}

function attachSessionIdToTildaForms() {
  const sessionId = getOrCreateSessionId();
  const forms = document.querySelectorAll("form");

  forms.forEach((form) => {
    let input = form.querySelector('input[name="session_id"]');

    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.name = "session_id";
      form.appendChild(input);
    }

    input.value = sessionId;
  });
}

document.addEventListener("DOMContentLoaded", attachSessionIdToTildaForms);

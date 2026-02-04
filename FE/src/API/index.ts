export function apiHeader() {
  const headers = new Headers();
  const token = localStorage.getItem("authToken") || "";
  headers.set("Authorization", `Bearer ${token}`);
  // headers.set("x-api-key", process.env.REACT_APP_API_X_KEY || "");

  return headers;
}

export const apiCall = async (apiUrl: string, method: string, body?: any) => {
  const headers = apiHeader();

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
    (headers as Headers).set("Content-Type", "application/json");
  }

  const res = await fetch(apiUrl, options);

  if (!res.ok) {
    throw new Error(`HTTP error! Status: ${res.status}`);
  }

  const textResponse = await res.text();

  try {
    return JSON.parse(textResponse); //parsing as JSON
  } catch (error) {
    console.error(error);
    return textResponse; //return the string
  }
};

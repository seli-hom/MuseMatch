export class FetchWrapper {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    // const url = "http://localhost/fungi-api/v1/fungi_species/";
    try {
      //*Step 3. Implement HTTP Client
      //   const uri = "https://api.tvmaze.com/                             shows";

      //TODO: add error handling.
      //*1. Check status code
      const response = await fetch(url, options);
      //   const response = await fetch(uri);
      if (!response.ok) {
        let serverErrorData = null;
        try {
          serverErrorData = await response.json();
        } catch (e) {
          console.log("Hello?");
        }
        throw new HttpError(
          response.status,
          response.statusText,
          serverErrorData,
        );
        // throw new Error(`
        // Request Failed : ${response.status} ${response.statusText}`);
      }
      //*Pass the list of fungi to be rendered

      if (response.status === 204) return null;
      const data = await response.json();
      console.log(data);
      return data;
    } catch (error) {
      if (error instanceof HttpError) throw error;

      throw new NetworkError(error.message);
      // throw new Error(`
      //   Request Failed : ${response.status} ${response.statusText}`);
      //   console.error(`hello it no work :( ${error}`);
    }
  }

  async get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  }
 
}

export class HttpError extends Error {
  constructor(status, statusText, errorData = null) {
    super(`Request Failed: ${status} ${statusText}`);
    this.name = "HttpError";
    this.status = status;
    this.statusText = statusText;
    this.errorData = errorData; // Stores the server's response object
  }
}

export class NetworkError extends Error {
  constructor(message) {
    super(`Network Error: ${message}`);
    this.name = "NetworkError";
  }
}
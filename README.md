# Weather.io Demo Project

This repository contains a lightweight implementation of the **Weather.io**
application based on the provided Software Requirements Specification (SRS).
The goal is to deliver a functional prototype that can be run locally
without any external dependencies beyond a recent version of Node.js.

## Features

* **User‑detectable location**: The app defaults to Secunderabad/Hyderabad,
  India, but you can specify any latitude and longitude in the header and
  save it for subsequent sessions.  Your selection is stored in
  `localStorage`.

* **Date selector**: Choose between Yesterday, Today, and Tomorrow.  The
  currently selected date is highlighted.

* **Weather retrieval**: Weather information is fetched from the
  public [wttr.in](https://wttr.in/) service.  Because the environment
  used for this project restricts outbound HTTP requests from the
  backend, the browser directly fetches the data.  Each fetch is
  cached for 15 minutes in `localStorage` to minimise network traffic.

* **Overrides**: You can click **Update Weather** to supply your own
  temperature, humidity, wind speed, precipitation and condition text
  for the selected day.  Overrides are saved on the backend, versioned
  and can be removed.  When an override exists, it replaces the
  corresponding values in the weather report and displays its
  version.  The **Remove Override** button is only visible when
  an override is active.

* **Minimal persistence**: Overrides are stored in `data/overrides.json`
  on the server.  This file is created automatically when you run the
  app.  There is no user login; overrides are anonymous.

* **Health check**: The backend exposes a `/health` endpoint that
  returns a simple status JSON object.

## Running the application

1. Ensure you have a recent version of Node.js installed (version 16+
   recommended).  No additional npm packages are required because
   everything uses the built‑in `http` module.

2. Change into the project directory and start the server:

   ```sh
   cd weatherio
   node server.js
   ```

   The server listens on port `8000` by default.  You can override
   this by setting the `PORT` environment variable.

3. Open your browser to `http://localhost:8000`.  The landing page
   loads the “Today” weather for the configured latitude and
   longitude.  Use the controls at the top to adjust the location.

4. To update the weather, click the **Update Weather** button,
   adjust the values in the modal form, and press **Save**.  To
   restore the original API values, click **Remove Override**.

## Notes and limitations

* **Historical data**: The free wttr.in service provides forecasts for
  the current day and the next two days.  It does not offer a
  historical API.  Therefore, the “Yesterday” view will return data
  from wttr.in’s first entry, which is usually today’s forecast.  A
  production deployment should switch to a weather provider that
  supports historical queries (e.g., Open‑Meteo or OpenWeatherMap).

* **Caching**: Weather API responses are cached client‑side for 15 minutes.
  If you update the weather, the cache for that date is cleared so
  subsequent requests return the override immediately.

* **Internationalisation**: All text is in English.  Strings are
  centralised in the UI code for easy modification.

* **Accessibility**: The UI follows a simple, high‑contrast design and
  uses semantic elements.  It should be navigable via keyboard
  (tab/enter) and includes basic aria labels through native form
  elements.

* **Security**: This demo does not implement rate limiting or any
  authentication.  In a production setting you should protect the
  override endpoints against abuse, store secrets securely, and use
  HTTPS.

We hope this implementation helps you get started with Weather.io.
Feel free to extend the features, replace the data source, or deploy
the serverless architecture described in the SRS.


https://wttr.in/18.9582,72.8321?format=j1
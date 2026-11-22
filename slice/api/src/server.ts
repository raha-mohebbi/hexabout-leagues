// this file runs the appliction creator file(app.ts)


import "dotenv/config";
import app from "./app.js";

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => {
  console.log(`API server is running on port ${PORT}`);
});

const _cors = require("cors");

const corsOptions = {
  origin: ["https://superfighters.vercel.app", "http://localhost:3000"],
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

const cors = _cors(corsOptions);

module.exports = {
  cors,
};

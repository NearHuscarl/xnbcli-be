const path = require("path");
const spawn = require("child_process").spawn;
const express = require("express");
const router = express.Router();
const multer = require("multer");
const fse = require("fs-extra");

const PROJECT_ROOT = path.join(__dirname, "..");
const XNB_PATH = path.join(PROJECT_ROOT, "node_modules/xnbcli");
const PACK_DIR = path.join(XNB_PATH, "packed");
const UNPACK_DIR = path.join(XNB_PATH, "unpacked");

function runCommand(commandStr, cwd) {
  return new Promise((resolve, reject) => {
    const command = spawn(commandStr, [], { cwd, shell: true });
    command.stdout.on("data", (data) => console.log(data.toString()));
    command.on("error", (error) => reject(error));
    command.on("close", (code) => {
      if (code !== 0) {
        reject(`command "${command}" process exited with code ${code}`);
      } else {
        resolve();
      }
    });
  });
}

function unpack() {
  return runCommand("npm run unpack", XNB_PATH);
}
function pack() {
  return runCommand("npm run pack", XNB_PATH);
}

const cleanUpXnb = async (basename) => {
  await fse.remove(path.join(PACK_DIR, basename + ".xnb"));
  await fse.remove(path.join(UNPACK_DIR, basename + ".json"));
  await fse.remove(path.join(UNPACK_DIR, basename + ".sfditem"));
};
const uniqueId = () => Date.now() + "_" + Math.round(Math.random() * 1e9);

const generateMetadataFile = (basename) => {
  return fse.outputFile(
    path.join(UNPACK_DIR, basename + ".json"),
    JSON.stringify({
      header: {
        target: "w",
        formatVersion: 5,
        hidef: false,
        compressed: 128,
      },
      readers: [
        {
          type: "SFD.Content.ItemsContentTypeReader, SFD.Content",
          version: 0,
        },
      ],
      content: {
        export: basename + ".sfditem",
      },
    }),
    "utf8"
  );
};

const uploadUnpackedItem = multer({
  fileFilter: (req, file, cb) => {
    const result = path.extname(file.originalname).toLowerCase() === ".sfditem";
    cb(null, result);
  },
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UNPACK_DIR),
    filename: (req, file, cb) => cb(null, uniqueId() + ".sfditem"),
  }),
  limits: {
    fileSize: 40 /* kb */ * 1024,
  },
});

router.post(
  "/packfile",
  uploadUnpackedItem.single("unpackedItem"),
  async (req, res, next) => {
    const { originalname, filename } = req.file;
    const basename = path.parse(filename).name;
    const packedFile = basename + ".xnb";

    console.log(`packing ${originalname}...`);
    await generateMetadataFile(basename);
    await pack();

    res.download(
      path.join(PACK_DIR, packedFile),
      path.parse(originalname).name + ".xnb"
    );
    await cleanUpXnb(basename);
  }
);

const uploadPackedItem = multer({
  fileFilter: (req, file, cb) => {
    const result = path.extname(file.originalname).toLowerCase() === ".xnb";
    cb(null, result);
  },
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, PACK_DIR),
    filename: (req, file, cb) => cb(null, uniqueId() + ".xnb"),
  }),
  limits: {
    fileSize: 40 /* kb */ * 1024,
  },
});

router.post(
  "/unpackfile",
  uploadPackedItem.single("packedItem"),
  async (req, res, next) => {
    const { originalname, filename } = req.file;

    console.log(`unpacking ${originalname}...`);
    await unpack();

    const basename = path.parse(filename).name;
    const unpackedFile = basename + ".sfditem";

    res.download(
      path.join(UNPACK_DIR, unpackedFile),
      path.parse(originalname).name + ".sfditem"
    );
    await cleanUpXnb(basename);
  }
);

router.post(
  "/unpack",
  uploadPackedItem.single("packedItem"),
  async (req, res, next) => {
    const { originalname, filename } = req.file;

    console.log(`unpacking ${originalname}...`);
    await unpack();

    const basename = path.parse(filename).name;
    const unpackedFile = basename + ".sfditem";

    const result = await fse.readFile(
      path.join(UNPACK_DIR, unpackedFile),
      "utf8"
    );
    res.json({ result: JSON.parse(result) });
    await cleanUpXnb(basename);
  }
);

module.exports = router;

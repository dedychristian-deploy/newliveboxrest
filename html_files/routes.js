const express = require("express");
const mse = require("./mse");
const fs = require("fs");
const path = require("path");


const router = express.Router();

const CONFIG_PATH = path.join(__dirname, "../config.json");

router.get("/playlists", async (req, res) => {
    try {
        const response = await mse.getPlaylists();

        res
            .status(response.statusCode)
            .type("application/atom+xml")
            .send(response.body);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

router.get("/playlist-status", async (req, res) => {
    try {
        const response = await mse.getPlaylistActivation();

        const active =
            response.statusCode >= 200 &&
            response.statusCode < 300 &&
            response.body.includes("active_on_profile");

        res.json({
            active,
            playlistId: response.playlistId
        });

    } catch (err) {
        res.status(500).json({
            active: false
        });
    }
});

router.get("/elements", async (req, res) => {
    try {
        const response = await mse.getElements(req.query.path);

        res
            .status(response.statusCode)
            .type("application/atom+xml")
            .send(response.body);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

router.get("/element", async (req, res) => {
    try {
        const response = await mse.getElement(req.query.url);

        res
            .status(response.statusCode)
            .type("application/vnd.vizrt.payload+xml")
            .send(response.body);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

router.put("/activate/:uuid", async (req, res) => {
    try {
        const response = await mse.activatePlaylist(req.params.uuid);

        res
            .status(response.statusCode)
            .type("text/plain")
            .send(response.body);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

router.post("/cleanup/:uuid", async (req, res) => {
    try {
        const response = await mse.cleanupPlaylist(req.params.uuid);

        res
            .status(response.statusCode)
            .type("text/plain")
            .send(response.body);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

router.post("/take", async (req, res) => {
    try {
        const response = await mse.takeElement(req.body);

        res
            .status(response.statusCode)
            .type("text/plain")
            .send(response.body);

    } catch (err) {
        res.status(500).send(err.message);
    }
});

router.post("/out", async (req, res) => {
    try {
        const response = await mse.takeOutElement(req.body);

        res
            .status(response.statusCode)
            .type("text/plain")
            .send(response.body);

    } catch (err) {
        res.status(500).send(err.message);
    }
});


router.post("/director-reset", async (req, res) => {
    try {
        const config = JSON.parse(
            fs.readFileSync(CONFIG_PATH, "utf8")
        );

        const [source, boxTypeRaw] = req.body.trim().split("|");
        const boxType = parseInt(boxTypeRaw, 10);

        console.log("DIRECTOR RESET REQUEST:");
        console.log("source  =", source);
        console.log("boxType =", boxType);

        // Director integration disabled
        if (!config.director?.enabled) {
            console.log("DIRECTOR RESET IGNORED - DISABLED");

            return res.json({
                ok: true,
                ignored: true,
                reason: "director_disabled"
            });
        }

        // Only accept Director requests
        if (source !== "director") {
            console.log("DIRECTOR RESET IGNORED - INVALID SOURCE:", source);

            return res.json({
                ok: true,
                ignored: true,
                reason: "invalid_source"
            });
        }

        if (Number.isNaN(boxType)) {
            return res.status(400).json({
                ok: false,
                error: "Invalid boxType"
            });
        }

        const resetCommand =
            `-1 MAIN_SCENE*TREE*$SCRIPT*SCRIPT INVOKE msg_director_take ${boxType}`;

        console.log("DIRECTOR RESET COMMAND:", resetCommand);

        await fetch(
            `http://127.0.0.1:9191/vizsend?host=${config.engine.host}&port=${config.engine.port}&cmd=${encodeURIComponent(resetCommand)}`
        );

        res.json({
            ok: true,
            source,
            boxType
        });

    } catch (err) {
        console.error("DIRECTOR RESET ERROR:", err);

        res.status(500).json({
            ok: false,
            error: err.message
        });
    }
});

module.exports = router;

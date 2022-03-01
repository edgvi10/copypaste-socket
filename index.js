import "dotenv/config";
import { Server } from "socket.io";
import DBWalker from "linkdevs-db-walker";

const io = new Server({ cors: { origin: "*" } });

export const base64 = (string) => {
    return {
        encode: () => Buffer.from(string, "utf8").toString("base64"),
        decode: () => Buffer.from(string, "base64").toString("utf8"),
        isBase64: () => typeof Buffer.from(string, "base64").toString("utf8") === string
    }
}

const getPaste = async (params) => {
    const db = new DBWalker();

    const select_paste_params = {};
    select_paste_params.table = "copypaste";
    select_paste_params.where = [`slug = '${params.slug}'`];

    const select_paste_sql = db.buildSelect(select_paste_params);
    const select_paste_result = await db.query(select_paste_sql);

    return select_paste_result;
};

const insertPaste = async (data) => {
    const db = new DBWalker();

    const insert_paste_params = {};
    insert_paste_params.table = "copypaste";
    insert_paste_params.data = { content: data.content };

    const insert_paste_sql = db.buildInsert(insert_paste_params);
    const insert_paste_result = await db.query(insert_paste_sql);

    return insert_paste_result;
};

const updatePaste = async (params, data) => {
    const db = new DBWalker();

    const update_paste_params = {};
    update_paste_params.table = "copypaste";
    update_paste_params.where = [`slug = '${params.slug}'`];
    update_paste_params.data = { content: data.content };

    const update_paste_sql = db.buildUpdate(update_paste_params);
    const update_paste_result = await db.query(update_paste_sql);

    return update_paste_result;
};

io.on("connection", (socket) => {
    socket.on("join", async (slug) => {
        console.log("joined", slug, socket.id);
        socket.join(slug);

        const select_paste = await getPaste({ slug });
        if (select_paste.error) console.log("error", select_paste);
        else {
            if (select_paste.length > 0) socket.emit("copy", select_paste[0]);
            else {
                const insert_paste = await insertPaste({ slug });
                if (insert_paste.error) console.log("error", insert_paste);
                else {
                    if (insert_paste.affectedRows > 0) {
                        socket.emit("copy", { id: insert_paste.insertId, slug });
                    }
                }
            }
        }
    });

    socket.on("paste", async (slug, received) => {
        console.log("paste", socket.id, slug, received);
        if (slug) {
            received.updated_at = new Date().toISOString();
            const update_paste = await updatePaste({ slug }, { content: received.content });
            if (update_paste.affectedRows > 0) {
                io.to(slug).emit("copy", received);
            } else {
                console.log("paste not found");
            }
        }
    });
});

io.listen(process.env.PORT || 3701);
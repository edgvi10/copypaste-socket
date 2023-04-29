import "dotenv/config";
import { Server } from "socket.io";
import DBWalker from "dbwalker";
import { v4 as uuidv4 } from "uuid";
import { date } from "locutus/php/datetime/index.js";

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
    select_paste_params.columns = ["*"];
    select_paste_params.where = [`slug = '${params.slug}'`];

    const select_paste_sql = db.buildSelect(select_paste_params);
    const select_paste_result = await db.query(select_paste_sql);

    return select_paste_result;
};

const insertPaste = async (data) => {
    const db = new DBWalker();

    const insert_paste_params = {};
    insert_paste_params.table = "copypaste";
    const insert_paste_params_data = {};

    insert_paste_params_data.uuid = data.uuid ?? uuidv4();
    if (data.slug) insert_paste_params_data.slug = data.slug;
    insert_paste_params_data.content = data.content ?? "";
    if (data.expire) insert_paste_params_data.expire = data.expire;
    insert_paste_params_data.privacy = data.privacy ?? "public";
    if (data.password) insert_paste_params_data.password = data.password;
    insert_paste_params_data.updated_at = data.updated_at ?? date("Y-m-d H:i:s");
    insert_paste_params_data.created_at = data.created_at ?? date("Y-m-d H:i:s");

    insert_paste_params.data = [insert_paste_params_data];

    const insert_paste_sql = db.buildInsert(insert_paste_params);
    const insert_paste_result = await db.query(insert_paste_sql);

    return insert_paste_result;
};

const updatePaste = async (params, data) => {
    const db = new DBWalker();

    const update_paste_params = {};
    update_paste_params.table = "copypaste";
    update_paste_params.where = [`slug = '${params.slug}'`];
    update_paste_params.data = {};

    if (data.content) update_paste_params.data.content = data.content;
    if (data.expire) update_paste_params.data.expire = data.expire;
    if (data.privacy) update_paste_params.data.privacy = data.privacy;
    if (data.password) update_paste_params.data.password = data.password;
    update_paste_params.data.updated_at = data.updated_at ?? date("Y-m-d H:i:s");

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
        if (select_paste.length > 0) socket.emit("copy", select_paste[0]);
        else console.log("paste new");
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
                const insert_paste = await insertPaste({ slug, content: received.content });
                if (insert_paste.affectedRows > 0) {
                    received.id = insert_paste.insertId;
                    io.to(slug).emit("copy", received);
                } else {
                    console.log("paste not inserted");
                }
            }
        }
    });
});

io.listen(process.env.PORT || 3701);
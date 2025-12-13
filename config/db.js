const { Pool } = require("pg")

const pool = new Pool({
    connectionString: "postgresql://elsie:2nITBGGAtYNnyYSCLYJnPqLtkCXpjMxe@dpg-d4i54umr433s73c6pie0-a.oregon-postgres.render.com/langster_db",
    ssl: {
        require: true,
        rejectUnauthorized: false,   
    }
})

pool.on("connect", () => {
    console.log("Connected to Postgres Database")
})

module.exports = pool;
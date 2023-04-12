const express = require('express');
const path = require('path')
const app = express();
const attendance_service_router = require('./routes/attendance_service_routes')
var cors = require('cors');

const PORT = 3000

app.use(express.json())
app.use(express.static('build'));
app.use(cors())

app.use("/attendance_service", attendance_service_router)

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "..", "build", "index.html"));
})


app.listen(PORT, () => {
    console.log("app listening on port:", PORT)
})
const express = require('express');
const app = express();
const PORT = 3000
const attendance_service_router = require('./routes/attendance_service_routes')

app.use(express.json())

app.get('/', (req, res) => {
    res.json({ 'msg': "200 OK" })
})

app.use(attendance_service_router)

app.listen(PORT, () => {
    console.log("app listening on port:", PORT)
})
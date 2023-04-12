const express = require('express');
const app = express();
const PORT = 3000
const attendance_service_router = require('./routes/attendance_service_routes')
const admin_panel_router = require('./routes/admin_panel_router')
var cors = require('cors');

app.use(express.json())
app.use(express.static('build'));

app.get('/', (req, res) => {
    res.json({ 'msg': "200 OK" })
})

app.use("/bpit_admin_panel", admin_panel_router)
app.use("/attendance_service", attendance_service_router)

app.listen(PORT, () => {
    console.log("app listening on port:", PORT)
})
from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION_START
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).parent
OUT = ROOT / "output" / "BPIT_API_Gateway_Attendance_Management_Report_Vidhatri_Nautiyal.docx"
ASSETS = ROOT / "tmp" / "report-assets"
OUT.parent.mkdir(parents=True, exist_ok=True)
ASSETS.mkdir(parents=True, exist_ok=True)

FONT = "Times New Roman"

GUIDE_NAME = "Prof. Achal Kaushik"
GUIDE_DESIGNATION = "Dean and Head of Department, Computer Science and Engineering, BPIT"
ORG_NAME = "Bhagwan Parshuram Institute of Technology (in-house training, Department of Computer Science and Engineering, under faculty guidance)"
DURATION = "June 2026 - August 2026"
ROLL_NO = "[ROLL NUMBER]"
ENROLL_NO = "[ENROLLMENT NUMBER]"

# ==============================
# Low level helpers
# ==============================
def set_run_font(run, size=12, bold=False, italic=False, underline=False):
    run.font.name = FONT
    run._element.rPr.rFonts.set(qn("w:ascii"), FONT)
    run._element.rPr.rFonts.set(qn("w:hAnsi"), FONT)
    run.font.size = Pt(size)
    run.bold, run.italic, run.underline = bold, italic, underline

def set_cell_text(cell, text, bold=False, size=10):
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(text)
    set_run_font(r, size, bold)
    cell.vertical_alignment = 1

def set_margins(section):
    section.top_margin = Inches(1)
    section.bottom_margin = Inches(1)
    section.left_margin = Inches(1.25)
    section.right_margin = Inches(1.25)

def add_field(paragraph, instruction, result_text="1"):
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar"); begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText"); instr.set(qn("xml:space"), "preserve"); instr.text = instruction
    sep = OxmlElement("w:fldChar"); sep.set(qn("w:fldCharType"), "separate")
    text = OxmlElement("w:t"); text.text = result_text
    end = OxmlElement("w:fldChar"); end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instr, sep, text, end])
    set_run_font(run, 10)
    return run

def page_number(section, roman=False, restart=None):
    if restart is not None:
        sectPr = section._sectPr
        pgNumType = sectPr.find(qn("w:pgNumType"))
        if pgNumType is None:
            pgNumType = OxmlElement("w:pgNumType")
            sectPr.append(pgNumType)
        pgNumType.set(qn("w:start"), str(restart))
    footer = section.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_field(p, "PAGE \\* ROMAN" if roman else "PAGE")

_bookmark_seq = [0]
def add_bookmark(paragraph, name):
    _bookmark_seq[0] += 1
    bid = str(_bookmark_seq[0])
    start = OxmlElement("w:bookmarkStart"); start.set(qn("w:id"), bid); start.set(qn("w:name"), name)
    end = OxmlElement("w:bookmarkEnd"); end.set(qn("w:id"), bid)
    paragraph._p.append(start)
    paragraph._p.append(end)

def add_pageref(paragraph, bookmark_name):
    add_field(paragraph, f"PAGEREF {bookmark_name} \\h", "1")

def dotted_entry(doc, label, bookmark_name=None, page_text=None, indent=False):
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing = 1.5
    if indent:
        p.paragraph_format.left_indent = Inches(0.3)
    tabs = p.paragraph_format.tab_stops
    tabs.add_tab_stop(Inches(6.0), 3, 2)  # right-aligned, dotted leader
    r = p.add_run(label + "\t")
    set_run_font(r, 12)
    if bookmark_name:
        add_pageref(p, bookmark_name)
    elif page_text:
        r2 = p.add_run(page_text); set_run_font(r2, 12)
    return p

def heading(doc, text, level=1, chapter=None, bookmark=None):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(12 if level == 1 else 8)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.keep_with_next = True
    p.paragraph_format.outline_level = level - 1
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER if level == 1 else WD_ALIGN_PARAGRAPH.LEFT
    if bookmark:
        add_bookmark(p, bookmark)
    label = (f"CHAPTER-{chapter}\n" if chapter else "") + (text.upper() if level == 1 else text)
    r = p.add_run(label)
    set_run_font(r, 14 if level == 1 else (12 if level == 2 else 10),
                 bold=(level <= 2), italic=(level >= 3), underline=(level == 2))
    return p

def para(doc, text, first_line=True):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    pf = p.paragraph_format
    pf.line_spacing = 1.5
    pf.space_after = Pt(6)
    if first_line: pf.first_line_indent = Inches(0.25)
    r = p.add_run(text)
    set_run_font(r, 12)
    return p

def bullet(doc, text):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.line_spacing = 1.5
    r = p.add_run(text); set_run_font(r, 12)
    return p

def caption(doc, text, bookmark=None):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(8)
    if bookmark:
        add_bookmark(p, bookmark)
    r = p.add_run(text); set_run_font(r, 11, italic=True)
    return p

def make_table(doc, headers, rows, col_widths=None):
    table = doc.add_table(rows=1, cols=len(headers)); table.style = "Table Grid"
    for c, t in zip(table.rows[0].cells, headers): set_cell_text(c, t, True, 10)
    for row in rows:
        cells = table.add_row().cells
        for c, t in zip(cells, row): set_cell_text(c, str(t), False, 9)
    if col_widths:
        for row in table.rows:
            for c, w in zip(row.cells, col_widths):
                c.width = Inches(w)
    return table

def insert_figure(doc, path, width=6.5):
    doc.add_picture(str(path), width=Inches(width))
    last = doc.paragraphs[-1]
    last.alignment = WD_ALIGN_PARAGRAPH.CENTER

def screenshot_placeholder(doc, label):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(10)
    t = doc.add_table(rows=1, cols=1)
    t.style = "Table Grid"
    cell = t.rows[0].cells[0]
    cell.width = Inches(6.5)
    para_cell = cell.paragraphs[0]
    para_cell.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = para_cell.add_run(f"[ Insert screenshot: {label} ]")
    set_run_font(r, 11, italic=True)
    for _ in range(3):
        cell.add_paragraph()

# ==============================
# Diagram drawing (PIL)
# ==============================
TFONT = "C:/Windows/Fonts/times.ttf"
TFONT_B = "C:/Windows/Fonts/timesbd.ttf"
TFONT_I = "C:/Windows/Fonts/timesi.ttf"

def _f(size, bold=False, italic=False):
    path = TFONT_B if bold else (TFONT_I if italic else TFONT)
    return ImageFont.truetype(path, size)

def _box(d, x, y, w, h, text, size=28, fill="white", outline="black", bold=False):
    d.rounded_rectangle((x, y, x + w, y + h), radius=14, outline=outline, width=3, fill=fill)
    font = _f(size, bold)
    lines = text.split("\n")
    lh = size + 10
    ty = y + h / 2 - (len(lines) * lh) / 2 + lh / 2
    for line in lines:
        d.text((x + w / 2, ty), line, font=font, fill="black", anchor="mm")
        ty += lh

def _oval(d, x, y, w, h, text, size=24):
    d.ellipse((x, y, x + w, y + h), outline="black", width=3, fill="white")
    font = _f(size)
    d.text((x + w / 2, y + h / 2), text, font=font, fill="black", anchor="mm", align="center")

def _varrow(d, x, y1, y2):
    d.line((x, y1, x, y2 - 16), fill="black", width=5)
    d.polygon([(x - 12, y2 - 16), (x + 12, y2 - 16), (x, y2)], fill="black")

def _harrow(d, x1, x2, y):
    d.line((x1, y, x2 - 16, y), fill="black", width=5)
    d.polygon([(x2 - 16, y - 12), (x2 - 16, y + 12), (x2, y)], fill="black")

def _title(d, w, text):
    d.text((w / 2, 40), text, font=_f(38, bold=True), fill="black", anchor="ma")

def diagram_columns(path, title, columns, arrows=True):
    im = Image.new("RGB", (1600, 620), "white"); d = ImageDraw.Draw(im)
    _title(d, 1600, title)
    n = len(columns); width = 320; gap = (1600 - n * width) // (n + 1)
    positions = []
    for i, (name, lines) in enumerate(columns):
        x = gap + i * (width + gap); y = 180
        positions.append((x, y))
        d.rounded_rectangle((x, y, x + width, y + 260), radius=18, outline="black", width=4)
        d.rectangle((x, y, x + width, y + 60), fill="black")
        d.text((x + width / 2, y + 30), name, font=_f(32, bold=True), fill="white", anchor="mm")
        for j, line in enumerate(lines):
            d.text((x + width / 2, y + 100 + j * 43), line, font=_f(30), fill="black", anchor="mm")
    if arrows:
        for i in range(n - 1):
            x, y = positions[i]; nx, _ = positions[i + 1]
            ay = y + 130
            _harrow(d, x + width, nx, ay)
    im.save(path)

def diagram_flow(path, title, steps, fork=None, width=1100, boxw=520, boxh=90, size=27):
    n = len(steps)
    gap = 46
    top = 110
    height = top + n * (boxh + gap) + (170 if fork else 40)
    im = Image.new("RGB", (width, height), "white"); d = ImageDraw.Draw(im)
    _title(d, width, title)
    cx = width // 2
    y = top
    for i, step in enumerate(steps):
        _box(d, cx - boxw // 2, y, boxw, boxh, step, size)
        if i < n - 1:
            _varrow(d, cx, y + boxh, y + boxh + gap)
        y += boxh + gap
    if fork:
        left_text, right_text = fork
        fy = y + 10
        _varrow(d, cx - 140, y - gap + boxh, fy)
        _varrow(d, cx + 140, y - gap + boxh, fy)
        bw = 380
        _box(d, cx - 420, fy, bw, 80, left_text, 24, fill="white")
        _box(d, cx + 40, fy, bw, 80, right_text, 24, fill="white")
    im.save(path)

def diagram_usecase(path):
    im = Image.new("RGB", (1500, 950), "white"); d = ImageDraw.Draw(im)
    _title(d, 1500, "Use Case Diagram")
    d.rounded_rectangle((90, 110, 1410, 900), radius=20, outline="black", width=4)
    d.text((750, 140), "BPIT Attendance Management System", font=_f(28, bold=True), fill="black", anchor="ma")

    actors = [
        ("Student", 220, ["Login", "View Profile", "View Timetable", "View Subjects", "View Attendance"]),
        ("Teacher", 750, ["Login", "View Profile", "View Timetable", "View Subjects",
                           "Perform Authorized\nAttendance Operations"]),
        ("Administrator", 1280, ["Login", "Manage Users", "Manage Roles", "Manage Permissions", "Manage Access"]),
    ]
    for name, ax, cases in actors:
        head_y = 220
        d.ellipse((ax - 22, head_y, ax + 22, head_y + 44), outline="black", width=4, fill="white")
        d.line((ax, head_y + 44, ax, head_y + 130), fill="black", width=4)
        d.line((ax - 40, head_y + 75, ax + 40, head_y + 75), fill="black", width=4)
        d.line((ax, head_y + 130, ax - 35, head_y + 190), fill="black", width=4)
        d.line((ax, head_y + 130, ax + 35, head_y + 190), fill="black", width=4)
        d.text((ax, head_y + 215), name, font=_f(26, bold=True), fill="black", anchor="ma")

        oy = 480
        for case in cases:
            _oval(d, ax - 155, oy, 310, 66, case, 20)
            d.line((ax, head_y + 190, ax, oy + 33), fill="black", width=2)
            oy += 82
    im.save(path)

def _diamond(d, cx, cy, w, h, text, size=26):
    pts = [(cx, cy - h / 2), (cx + w / 2, cy), (cx, cy + h / 2), (cx - w / 2, cy)]
    d.polygon(pts, outline="black", width=4, fill="white")
    d.text((cx, cy), text, font=_f(size, bold=True), fill="black", anchor="mm", align="center")

def _biarrow(d, x1, y1, x2, y2):
    d.line((x1, y1, x2, y2), fill="black", width=3)
    import math
    ang = math.atan2(y2 - y1, x2 - x1)
    for (bx, by, direction) in [(x1, y1, ang), (x2, y2, ang + math.pi)]:
        p1 = (bx + 18 * math.cos(direction - 0.4), by + 18 * math.sin(direction - 0.4))
        p2 = (bx + 18 * math.cos(direction + 0.4), by + 18 * math.sin(direction + 0.4))
        d.polygon([p1, p2, (bx, by)], fill="black")

def diagram_context_dfd(path):
    """Level-0 / Context DFD: one process, three external entities, star topology (no crossings)."""
    im = Image.new("RGB", (1400, 900), "white"); d = ImageDraw.Draw(im)
    _title(d, 1400, "Level-0 (Context) Data Flow Diagram")
    cx, cy = 700, 470
    pw, ph = 340, 190
    ebw, ebh = 260, 100

    student = (cx, 150)
    teacher = (cx - 480, 700)
    admin = (cx + 480, 700)

    _biarrow(d, student[0], student[1] + ebh / 2, cx, cy - ph / 2)
    _biarrow(d, teacher[0], teacher[1] - ebh / 2, cx - pw / 2, cy)
    _biarrow(d, admin[0], admin[1] - ebh / 2, cx + pw / 2, cy)

    _box(d, cx - pw / 2, cy - ph / 2, pw, ph, "ATTENDANCE\nMANAGEMENT\nSYSTEM", 26, bold=True)
    for name, ex, ey in [("STUDENT", *student), ("TEACHER", *teacher), ("ADMINISTRATOR", *admin)]:
        _box(d, ex - ebw / 2, ey - ebh / 2, ebw, ebh, name, 24, bold=True)
    im.save(path)

def diagram_level1_dfd(path):
    """Level-1 DFD: sequential process decomposition ending in a data store, no numbering."""
    procs = ["AUTHENTICATION", "JWT\nVERIFICATION", "RBAC AND\nPERMISSION CHECK", "ACADEMIC\nSERVICES"]
    n = len(procs)
    w, h = 300, 150
    dw, dh = 220, 150
    gap = 70
    margin = 60
    width = margin * 2 + n * w + n * gap + dw
    height = 420
    im = Image.new("RGB", (width, height), "white"); d = ImageDraw.Draw(im)
    _title(d, width, "Level-1 Data Flow Diagram")
    y = 180
    xs = []
    for i, p in enumerate(procs):
        x = margin + i * (w + gap)
        xs.append(x)
        d.ellipse((x, y, x + w, y + h), outline="black", width=4, fill="white")
        d.text((x + w / 2, y + h / 2), p, font=_f(24, bold=True), fill="black", anchor="mm", align="center")
    for i in range(n - 1):
        _harrow(d, xs[i] + w, xs[i + 1], y + h / 2)
    # Data store (open rectangle, double top rule) directly after the last process
    dx = xs[-1] + w + gap
    dy = y
    d.rectangle((dx, dy, dx + dw, dy + dh), outline="black", width=4, fill="white")
    d.line((dx, dy + 14, dx + dw, dy + 14), fill="black", width=3)
    d.text((dx + dw / 2, dy + dh / 2 + 8), "DATABASE", font=_f(24, bold=True), fill="black", anchor="mm")
    _harrow(d, xs[-1] + w, dx, y + h / 2)
    im.save(path)

def diagram_er(path):
    """ER diagram: authorization chain (left) with academic entities fanned off USERS via
    orthogonal connectors at distinct x-offsets, so no two lines ever cross."""
    im = Image.new("RGB", (1550, 950), "white"); d = ImageDraw.Draw(im)
    _title(d, 1550, "Entity Relationship Diagram")

    chain = ["USERS", "USER_ROLES", "ROLES", "ROLE_PERMISSIONS", "PERMISSIONS"]
    bw, bh = 280, 80
    cx = 220
    y = 150
    positions = {}
    for name in chain:
        _box(d, cx - bw // 2, y, bw, bh, name, 22, bold=True)
        positions[name] = (cx, y)
        if name != chain[-1]:
            _varrow(d, cx, y + bh, y + bh + 50)
        y += bh + 50

    right_x = cx + bw // 2
    users_mid_y = positions["USERS"][1] + bh / 2
    academic = [("SUBJECTS", 1120, 150), ("TIMETABLE_SLOTS", 1120, 350), ("ATTENDANCE_RECORDS", 1120, 550)]
    abw, abh = 360, 80
    branch_xs = [600, 700, 800]
    for (name, ax, ay), bx in zip(academic, branch_xs):
        _box(d, ax, ay, abw, abh, name, 20, bold=True)
        target_y = ay + abh / 2
        d.line((right_x, users_mid_y, bx, users_mid_y), fill="black", width=3)
        if target_y != users_mid_y:
            d.line((bx, users_mid_y, bx, target_y), fill="black", width=3)
        _harrow(d, bx, ax, target_y)
    im.save(path)

diagram_columns(ASSETS / "architecture.png", "Overall System Architecture", [
    ("Client / API User", ["Browser Dashboard", "Postman / API Client"]),
    ("Express API Gateway", ["Authentication", "JWT Validation", "RBAC / Permissions"]),
    ("Data and Services", ["MySQL Database", "Academic Services", "Attendance Service Proxy"]),
])
diagram_usecase(ASSETS / "usecase.png")
diagram_context_dfd(ASSETS / "context-dfd.png")
diagram_level1_dfd(ASSETS / "level1-dfd.png")
diagram_er(ASSETS / "er.png")
diagram_flow(ASSETS / "auth-flow.png", "Authentication and JWT Flow", [
    "User submits Username + Password",
    "Authentication API validates credentials\nagainst MySQL database",
    "JWT generated (id, username, email,\nroles, permissions) - expires in 30 minutes",
    "Protected request sent with JWT",
    "JWT Middleware validates token\nand account status",
    "RBAC / Permission Middleware\nverifies required role/permission",
], fork=("Authorized -> Controller", "Unauthorized -> 401/403 Reject"))
diagram_flow(ASSETS / "attendance-flow.png", "Attendance Management Workflow", [
    "User Login",
    "JWT Authentication",
    "Identify User Role",
    "Check Permission (manage_attendance)",
    "Validate Subject Against Academic Catalogue",
    "Create or Update Attendance Record",
    "Return API Response",
])
diagram_flow(ASSETS / "api-flow.png", "API Request and Response Flow", [
    "Client Request",
    "Express Route",
    "Authentication Middleware (auth)",
    "Authorization Middleware (requirePermission)",
    "Controller / Application Logic",
    "MySQL Database (Sequelize)",
    "JSON Response",
])
diagram_flow(ASSETS / "testing-flow.png", "API Testing and Validation Workflow", [
    "Create API Request (Postman / smoke-test.js)",
    "Send Request to Gateway",
    "Authentication Check",
    "Authorization Check",
    "Execute Operation",
    "Receive Response",
    "Validate Status and Response Data",
    "Record Test Result (Pass / Fail)",
])

# ==============================
# Document assembly
# ==============================
doc = Document()
for s in doc.sections: set_margins(s)
styles = doc.styles
styles["Normal"].font.name = FONT
styles["Normal"]._element.rPr.rFonts.set(qn("w:ascii"), FONT)
styles["Normal"].font.size = Pt(12)

def center(text, size, bold=False, before=0):
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if before: p.paragraph_format.space_before = Pt(before)
    r = p.add_run(text); set_run_font(r, size, bold)
    return p

# ---------- SECTION 1: Title / Declaration / Acknowledgement / Certificates (no page numbers) ----------
center("SUMMER TRAINING REPORT", 20, True, before=24)
center("", 12)
center("BPIT API GATEWAY BASED ATTENDANCE MANAGEMENT SYSTEM", 18, True, before=18)
center("", 12)
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_before = Pt(18)
r = p.add_run("Submitted in partial fulfillment of the requirements for the award of the degree of")
set_run_font(r, 13)
center("BACHELOR OF TECHNOLOGY", 14, True, before=12)
center("IN COMPUTER SCIENCE AND ENGINEERING", 14, True)
center("", 12)
center("Submitted By", 13, before=20)
center("VIDHATRI NAUTIYAL", 15, True)
center("", 8)
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_before = Pt(10)
r = p.add_run("B.Tech. Computer Science and Engineering\nBhagwan Parshuram Institute of Technology\nGGS Indraprastha University, Delhi")
set_run_font(r, 12)
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_before = Pt(14)
r = p.add_run(f"University Roll No.: {ROLL_NO}\nEnrollment No.: {ENROLL_NO}")
set_run_font(r, 12)
center("Under the Guidance of", 13, before=20)
center(GUIDE_NAME, 13, True)
center(GUIDE_DESIGNATION, 12)
center("Training Organization", 13, before=18)
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run(ORG_NAME); set_run_font(r, 12)
center("Training Duration", 13, before=16)
center(DURATION, 12)
center("", 10)
center("DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING", 13, True, before=24)
center("BHAGWAN PARSHURAM INSTITUTE OF TECHNOLOGY", 13, True)
center("GGS INDRAPRASTHA UNIVERSITY, DELHI", 13, True)
center("ACADEMIC SESSION 2026-2027", 12, before=10)
doc.add_page_break()

# Declaration
center("DECLARATION", 14, True)
para(doc, f"I hereby declare that the Summer Training Report entitled \u201cBPIT API Gateway Based "
          f"Attendance Management System\u201d is an original work carried out by me as part of my Summer "
          f"Training under the guidance of {GUIDE_NAME} at {ORG_NAME}.")
para(doc, "The work presented in this report is based on my learning, implementation, analysis, and "
          "contribution during the training period. The project focuses on an API-based academic "
          "attendance and timetable management system with emphasis on authentication, JSON Web Token "
          "(JWT) based authentication, Role-Based Access Control (RBAC), permission management, protected "
          "API routes, and relational database design.")
para(doc, "I further declare that this report has not been submitted, either wholly or partially, for the "
          "award of any other degree, diploma, or academic qualification. Wherever information from "
          "external technical resources has been used, appropriate references have been provided.")
p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(30)
r = p.add_run("Name: Vidhatri Nautiyal"); set_run_font(r, 12, True)
p = doc.add_paragraph(); r = p.add_run(f"Roll No.: {ROLL_NO}"); set_run_font(r, 12, True)
p = doc.add_paragraph(); r = p.add_run(f"Enrollment No.: {ENROLL_NO}"); set_run_font(r, 12, True)
p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(16)
r = p.add_run("Signature: ___________________________"); set_run_font(r, 12, True)
p = doc.add_paragraph()
r = p.add_run("Date: _______________________________"); set_run_font(r, 12, True)
doc.add_page_break()

# Acknowledgement
center("ACKNOWLEDGEMENT", 14, True)
para(doc, "I would like to express my sincere gratitude to everyone who supported and guided me throughout "
          "my Summer Training and contributed to the successful completion of the project entitled "
          "\u201cBPIT API Gateway Based Attendance Management System.\u201d")
para(doc, "I am grateful to the Department of Computer Science and Engineering, Bhagwan Parshuram Institute "
          "of Technology, GGS Indraprastha University, for providing me with the opportunity to undertake "
          "this training and gain practical exposure to software development and backend engineering.")
para(doc, f"I would especially like to thank my project guide and mentor, {GUIDE_NAME}, "
          f"{GUIDE_DESIGNATION}, for providing valuable guidance, constructive feedback, and technical "
          "direction throughout the development of the project. The guidance received during the training "
          "helped me understand the practical aspects of backend development, authentication, authorization, "
          "database design, API development, and software engineering.")
para(doc, "I am also thankful to the Department for providing an environment in which I could apply my "
          "academic knowledge to a practical software development problem. The training experience "
          "strengthened my understanding of Node.js, Express.js, REST APIs, MySQL, JWT authentication, "
          "Role-Based Access Control, permission management, and protected API routes.")
para(doc, "I would also like to express my gratitude to the faculty members of the Computer Science and "
          "Engineering Department for their continuous support and encouragement.")
para(doc, "Finally, I am thankful to my family, friends, and everyone who supported me directly or "
          "indirectly throughout the training period.")
p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(20)
r = p.add_run("Vidhatri Nautiyal"); set_run_font(r, 12, True)
doc.add_page_break()

center("COMPANY CERTIFICATE", 14, True)
para(doc, "This page is reserved for the signed certificate for the training period, issued by the "
          "Department of Computer Science and Engineering, BPIT, since the training was conducted "
          "in-house under faculty guidance.", False)
doc.add_page_break()

center("TRAINING COORDINATOR CERTIFICATE", 14, True)
para(doc, f"This is to certify that the report entitled \u201cBPIT API Gateway Based Attendance Management "
          f"System\u201d submitted by Vidhatri Nautiyal in partial fulfilment of the requirement for the "
          f"award of the degree of B.Tech in Computer Science and Engineering at BPIT, GGSIP University, "
          f"is a record of the candidate's own work carried out under my guidance and is prepared in "
          f"accordance with the prescribed format.")
p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(36)
r = p.add_run(f"Date: ____________________                                      {GUIDE_NAME}\n"
              f"                                                                            {GUIDE_DESIGNATION}")
set_run_font(r, 12, True)
doc.add_page_break()

# ---------- SECTION 2: TOC / LoF / LoT / Abstract - Roman numerals (footer continues absolute count) ----------
sec2 = doc.add_section(WD_SECTION_START.NEW_PAGE)
set_margins(sec2)
sec2.footer.is_linked_to_previous = False
page_number(sec2, roman=True)

center("TABLE OF CONTENTS", 14, True)
toc_p = doc.add_paragraph()
add_field(toc_p, 'TOC \\o "1-3" \\h \\z \\u',
          "Right-click here and choose \"Update Field\" (or press F9) to generate the "
          "Table of Contents with page numbers after the report is finalized.")
note_p = doc.add_paragraph()
note_p.paragraph_format.space_before = Pt(10)
r = note_p.add_run("Note: This Table of Contents is an auto-updating Word field built from the chapter "
                    "and section headings. Update it (Ctrl+A, then F9, or References → Update Table) "
                    "after any final edits so the page numbers stay accurate.")
set_run_font(r, 10, italic=True)
doc.add_page_break()

center("LIST OF FIGURES", 14, True)
p = doc.add_paragraph(); p.paragraph_format.line_spacing = 1.5
r = p.add_run("Figure No."); set_run_font(r, 12, True)
r = p.add_run("\t\tFigure Title"); set_run_font(r, 12, True)
figures_index = [
    ("Fig. 3.1", "Overall System Architecture", "fig_3_1"),
    ("Fig. 3.2", "Use Case Diagram", "fig_3_2"),
    ("Fig. 3.3", "Context-Level Data Flow Diagram", "fig_3_3"),
    ("Fig. 3.4", "Level-1 Data Flow Diagram", "fig_3_4"),
    ("Fig. 3.5", "Entity Relationship Diagram", "fig_3_5"),
    ("Fig. 3.6", "Authentication and Authorization Flow", "fig_3_6"),
    ("Fig. 3.7", "Attendance Management Workflow", "fig_3_7"),
    ("Fig. 4.1", "Backend Project Structure", "fig_4_1"),
    ("Fig. 4.2", "API Request and Response Flow", "fig_4_2"),
    ("Fig. 5.1", "API Testing and Validation", "fig_5_1"),
]
for num, title, bm in figures_index:
    dotted_entry(doc, f"{num}  {title}", bookmark_name=bm)
doc.add_page_break()

center("LIST OF TABLES", 14, True)
tables_index = [
    ("Table 2.1", "System Users and Responsibilities", "tab_2_1"),
    ("Table 2.2", "Functional Requirements", "tab_2_2"),
    ("Table 2.3", "Non-Functional Requirements", "tab_2_3"),
    ("Table 2.4", "Technology Requirements", "tab_2_4"),
    ("Table 2.5", "Database Requirements", "tab_2_5"),
    ("Table 2.6", "Security Requirements", "tab_2_6"),
    ("Table 2.7", "System Constraints", "tab_2_7"),
    ("Table 4.1", "Backend Modules and Responsibilities", "tab_4_1"),
    ("Table 4.2", "Role and Access Overview", "tab_4_2"),
    ("Table 5.1", "Authentication Test Cases", "tab_5_1"),
    ("Table 5.2", "RBAC Test Cases", "tab_5_2"),
    ("Table 5.3", "Attendance Test Cases", "tab_5_3"),
    ("Table 5.4", "Testing Summary", "tab_5_4"),
    ("Table 6.1", "Existing and Proposed System Comparison", "tab_6_1"),
    ("Table 6.3", "Advantages of RBAC", "tab_6_3"),
    ("Table A.1", "API Endpoint Documentation", "tab_a_1"),
    ("Table B.1", "Database/Data Dictionary", "tab_b_1"),
]
for num, title, bm in tables_index:
    dotted_entry(doc, f"{num}  {title}", bookmark_name=bm)
doc.add_page_break()

center("ABSTRACT", 14, True)
para(doc, "The BPIT API Gateway Based Attendance Management System is an academic attendance and "
          "timetable management solution developed using Node.js and Express.js with a MySQL relational "
          "database. The project provides a structured API gateway through which academic and "
          "attendance-related resources can be accessed while applying appropriate authentication and "
          "authorization mechanisms.")
para(doc, "The initial system provided an Express.js and MySQL based attendance API gateway with limited "
          "role handling and an authentication approach based on Microsoft authentication. The system was "
          "enhanced by introducing username/password authentication, JSON Web Token (JWT) based "
          "authentication, Role-Based Access Control (RBAC), permission-based authorization, and protected "
          "API routes.")
para(doc, "A major component of the project is the development of a scalable relational structure for "
          "managing users, roles, and permissions. The primary roles considered in the system are Student, "
          "Teacher, and Administrator. Each role is associated with a defined set of responsibilities and "
          "access privileges.")
para(doc, "The API gateway acts as a common backend layer between clients and academic resources. "
          "Authentication establishes the identity of the user, while authorization determines whether the "
          "authenticated user has the required role and permission to access a particular resource. This "
          "separation provides a structured approach to securing API operations.")
para(doc, "The project also supports academic functionality related to attendance, timetable, and subject "
          "information. Students can access applicable academic and attendance information, teachers can "
          "perform authorized attendance operations, and administrators can manage access-related "
          "functionality.")
para(doc, "The project demonstrates the practical application of backend development concepts including "
          "REST API design, Express.js middleware, JWT authentication, Role-Based Access Control, "
          "relational database design, protected routes, validation, error handling, and API testing. "
          "End-to-end smoke testing of the implemented API confirmed that most core workflows operate "
          "correctly, while also identifying a small number of authorization checks that still require "
          "correction. The implementation provides a maintainable and extensible foundation for further "
          "development of an academic management platform.")

# ---------- SECTION 3: Main body - Arabic numerals restarting at 1 ----------
sec3 = doc.add_section(WD_SECTION_START.NEW_PAGE)
set_margins(sec3)
sec3.footer.is_linked_to_previous = False
page_number(sec3, roman=False, restart=1)

# ============ CHAPTER 1 ============
heading(doc, "INTRODUCTION", 1, 1)

heading(doc, "1.1 Background", 2)
para(doc, "Educational institutions manage a large amount of academic information, including student "
          "records, faculty information, subjects, timetables, and attendance. As the number of users and "
          "academic operations increases, managing this information through disconnected or manually "
          "maintained systems becomes difficult.")
para(doc, "A modern academic management system requires controlled access to information according to the "
          "responsibilities of different users. Students should be able to access their own academic and "
          "attendance information, teachers should be able to perform authorized academic operations, and "
          "administrators should have broader access for managing users and access permissions.")
para(doc, "An Application Programming Interface (API) provides a structured method for communication "
          "between applications and backend services. An API gateway can act as a common entry point "
          "through which requests are authenticated, authorized, processed, and connected to the required "
          "backend functionality.")
para(doc, "The BPIT API Gateway Based Attendance Management System was developed in this context using "
          "Node.js, Express.js, and MySQL. The project particularly focuses on authentication, JWT-based "
          "authentication, Role-Based Access Control, permission management, protected routes, and academic "
          "attendance functionality.")

heading(doc, "1.2 Project Overview", 2)
para(doc, "The BPIT API Gateway Based Attendance Management System provides a centralized backend API for "
          "an academic attendance and timetable management environment.")
para(doc, "The system follows the general flow:", False)
para(doc, "User \u2192 Authentication \u2192 JWT \u2192 Role \u2192 Permission \u2192 Protected Resource", False)
para(doc, "The major user roles are Student, Teacher, and Administrator.")
para(doc, "The API gateway receives requests from clients and performs the required authentication and "
          "authorization checks before allowing access to protected resources. Academic data is stored and "
          "retrieved through the MySQL database.")
para(doc, "The system combines security-related functionality with academic operations such as attendance, "
          "timetable, and subject management.")

heading(doc, "1.3 Problem Statement", 2)
para(doc, "A basic attendance API can provide academic functionality, but without a structured "
          "authentication and authorization mechanism, controlling access to different resources becomes "
          "difficult.")
para(doc, "The project addresses the following problems:", False)
for x in ["Limited centralized authentication.", "Limited role-based access control.",
          "Lack of granular permission management.",
          "Repetition of authorization logic across protected resources.",
          "Difficulty in maintaining user-role relationships.",
          "Need for secure access to academic and attendance information.",
          "Need for a structured backend API layer.", "Need for a scalable authorization schema."]:
    bullet(doc, x)

heading(doc, "1.4 Existing System", 2)
para(doc, "The initial system consisted of an Express.js and MySQL based attendance API gateway. It "
          "provided a foundation for attendance-related backend operations but had limited role handling.")
para(doc, "The existing authentication approach relied on Microsoft (Azure AD / MSAL) sign-in only. There "
          "was also scope for improving the organization of authentication, authorization, roles, and "
          "permissions.")
para(doc, "The initial system did not provide a sufficiently usable interface for complete interaction with "
          "all academic functionality. Therefore, the project provided an opportunity to improve the "
          "security architecture and extend the overall usability of the system.")

heading(doc, "1.5 Proposed System", 2)
para(doc, "The enhanced system introduces a structured authentication and authorization layer over the "
          "existing backend, adding local username/password sign-in alongside the existing Microsoft "
          "sign-in, with both paths unified into one common gateway token.")
para(doc, "The major enhancements include:", False)
for x in ["Username/password authentication (in addition to existing Microsoft sign-in).",
          "JWT-based authentication.", "Role-Based Access Control.", "Permission-based authorization.",
          "Protected API routes.", "Scalable user-role-permission relationships.",
          "Academic attendance functionality.", "Timetable and subject-related information.",
          "Role-based user interaction."]:
    bullet(doc, x)
para(doc, "The proposed request flow is:", False)
para(doc, "Client Request \u2192 Express API Gateway \u2192 Authentication \u2192 JWT Validation \u2192 Role "
          "and Permission Verification \u2192 Application Logic \u2192 MySQL Database \u2192 API Response", False)

heading(doc, "1.6 Objectives", 2)
for x in ["To develop a structured backend API gateway using Node.js and Express.js.",
          "To implement username/password authentication.", "To use JWT for authenticated API requests.",
          "To implement Role-Based Access Control.", "To implement permission-based authorization.",
          "To protect sensitive API routes.", "To develop a scalable relational user schema.",
          "To establish user-role-permission relationships.",
          "To support attendance-related academic operations.",
          "To support timetable and subject-related academic information.",
          "To improve the maintainability and extensibility of backend authorization."]:
    bullet(doc, x)

heading(doc, "1.7 Scope of the Project", 2)
para(doc, "The project primarily covers the backend/API layer and the academic attendance management "
          "functionality.")
para(doc, "The scope includes:", False)
for x in ["User authentication.", "JWT-based authentication.", "User roles.", "Permission management.",
          "Role-Based Access Control.", "Protected routes.", "User-role-permission relationships.",
          "Attendance-related operations.", "Timetable-related information.", "Subject-related information.",
          "Role-based academic access.", "API testing and validation."]:
    bullet(doc, x)
para(doc, "The system provides a foundation that can be further extended into a larger academic management "
          "platform.")

heading(doc, "1.8 Project Contribution", 2)
para(doc, "The major contribution of the project was the enhancement and organization of the authentication "
          "and authorization architecture.")
para(doc, "The implementation separates authentication, role identification, permission verification, and "
          "protected resource access into connected stages. This provides a structured security mechanism "
          "that can be reused across different API resources.")
para(doc, "The enhanced architecture can be summarized as:", False)
para(doc, "Authentication + JWT + RBAC + Permissions + Protected Routes + Relational User Schema", False)
para(doc, "The project also integrates these security mechanisms with academic attendance, timetable, and "
          "subject-related functionality.")

heading(doc, "1.9 Organization of the Report", 2)
para(doc, "This report is organized into eight chapters.")
para(doc, "Chapter-1 introduces the project, its background, problem statement, existing system, proposed "
          "system, objectives, scope, and contribution.")
para(doc, "Chapter-2 presents the Software Requirements Specification, including system users, functional "
          "and non-functional requirements, hardware and software requirements, database requirements, "
          "security requirements, and constraints.")
para(doc, "Chapter-3 presents the major system diagrams including the system architecture, use case "
          "diagram, data flow diagrams, ER diagram, authentication flow, and attendance workflow.")
para(doc, "Chapter-4 describes the process selection and implementation of the backend, authentication, "
          "JWT, RBAC, permissions, protected routes, database structure, attendance functionality, and user "
          "interface.")
para(doc, "Chapter-5 presents the testing methodology and results.")
para(doc, "Chapter-6 provides comparisons and analysis of the existing and enhanced systems and discusses "
          "the major design decisions, challenges, and limitations.")
para(doc, "Chapter-7 presents the conclusions, learning outcomes, and future scope.")
para(doc, "Chapter-8 contains the references used during the development and documentation of the project.")

# ============ CHAPTER 2 ============
heading(doc, "SRS", 1, 2)

heading(doc, "2.1 Introduction", 2)
para(doc, "The Software Requirements Specification defines the functional and non-functional requirements "
          "of the BPIT API Gateway Based Attendance Management System.")
para(doc, "The requirements cover the system users, application functionality, technical environment, "
          "database structure, security requirements, and system constraints.")

heading(doc, "2.2 System Users", 2)
caption(doc, "Table 2.1: System Users and Responsibilities", "tab_2_1")
make_table(doc, ["User", "Responsibilities"], [
    ["Student", "Access applicable personal academic, timetable, subject, and attendance information"],
    ["Teacher", "Access applicable academic information and perform authorized attendance operations"],
    ["Administrator", "Manage users, roles, permissions, and administrative access"],
    ["API Client", "Send requests to the backend API"],
])

heading(doc, "2.3 Functional Requirements", 2)
caption(doc, "Table 2.2: Functional Requirements", "tab_2_2")
make_table(doc, ["ID", "Requirement", "Description"], [
    ["FR-01", "User Authentication", "The system shall authenticate users using valid credentials."],
    ["FR-02", "JWT Generation", "The system shall generate a JWT following successful authentication."],
    ["FR-03", "JWT Validation", "Protected requests shall validate the authentication token."],
    ["FR-04", "User Identification", "The system shall identify the authenticated user."],
    ["FR-05", "Role Assignment", "Users shall be associated with appropriate system roles."],
    ["FR-06", "Permission Management", "Roles shall be associated with appropriate permissions."],
    ["FR-07", "RBAC", "The system shall restrict resources according to user roles and permissions."],
    ["FR-08", "Protected Routes", "Sensitive API routes shall require authentication and authorization."],
    ["FR-09", "Attendance Access", "Authorized users shall be able to perform applicable attendance operations."],
    ["FR-10", "Timetable Access", "Authorized users shall be able to access applicable timetable information."],
    ["FR-11", "Subject Access", "The system shall support subject-related academic information."],
    ["FR-12", "Access Restriction", "Unauthorized requests shall be rejected."],
    ["FR-13", "Relational User Schema", "User, role, and permission relationships shall be represented through relational entities."],
    ["FR-14", "Error Handling", "Invalid and unauthorized requests shall be handled appropriately."],
])

heading(doc, "2.4 Non-Functional Requirements", 2)
caption(doc, "Table 2.3: Non-Functional Requirements", "tab_2_3")
make_table(doc, ["Category", "Requirement"], [
    ["Security", "Protected resources must require appropriate authentication and authorization."],
    ["Maintainability", "Authentication and authorization components should be modular and reusable."],
    ["Scalability", "The role and permission model should support future expansion."],
    ["Reliability", "Invalid requests should be handled without compromising system integrity."],
    ["Usability", "API requests and responses should follow consistent behavior."],
    ["Performance", "Authentication and authorization should introduce minimal unnecessary overhead."],
    ["Modularity", "Different backend responsibilities should remain logically separated."],
    ["Data Integrity", "Relationships between users, roles, permissions, and academic information should remain consistent."],
    ["Extensibility", "New roles and permissions should be possible without redesigning the entire system."],
])

heading(doc, "2.5 Hardware Requirements", 2)
para(doc, "The system does not require specialized hardware for development.")
make_table(doc, ["Component", "Requirement"], [
    ["Processor", "Modern x64 processor"],
    ["RAM", "8 GB or higher recommended"],
    ["Storage", "Sufficient storage for source code, dependencies, and database"],
    ["Network", "Required for API communication and development dependencies"],
    ["Display", "Standard monitor/display"],
])

heading(doc, "2.6 Software Requirements", 2)
para(doc, "The software environment consists of:", False)
for x in ["Windows/Linux/macOS operating system.", "Node.js.", "Express.js.", "JavaScript.", "MySQL.",
          "Postman.", "Code editor or IDE.", "Git for source-code version control."]:
    bullet(doc, x)

heading(doc, "2.7 Technology Requirements", 2)
caption(doc, "Table 2.4: Technology Requirements", "tab_2_4")
make_table(doc, ["Technology", "Purpose"], [
    ["Node.js", "Backend runtime environment"],
    ["Express.js 4", "Backend web/API framework"],
    ["JavaScript", "Programming language"],
    ["MySQL", "Relational database management system"],
    ["Sequelize 6 / mysql2", "Object-relational mapping and MySQL driver"],
    ["jose / jsonwebtoken", "Token-based (JWT) authentication"],
    ["REST API", "Client-server communication"],
    ["Axios", "Gateway-to-downstream-service HTTP communication"],
    ["dotenv", "Environment-based configuration"],
    ["Postman", "API testing and validation"],
    ["Git", "Source-code version control"],
])
para(doc, "The exact package versions used in the implementation are recorded in the project's "
          "package.json (for example, express ^4.22.1, sequelize ^6.37.8, mysql2 ^3.19.1, jose ^6.1.3, "
          "jsonwebtoken ^9.0.3, axios ^1.13.5).")

heading(doc, "2.8 Database Requirements", 2)
para(doc, "The database must support academic information as well as authorization-related information.")
para(doc, "The authorization structure follows:", False)
para(doc, "Users \u2192 User Roles \u2192 Roles \u2192 Role Permissions \u2192 Permissions", False)
para(doc, "This relational approach separates users from their access definitions and allows the system to "
          "support additional roles and permissions.")
caption(doc, "Table 2.5: Database Requirements", "tab_2_5")
make_table(doc, ["Requirement", "Description"], [
    ["User Storage", "Store user-related information."],
    ["Role Storage", "Store available system roles."],
    ["Permission Storage", "Store individual permissions."],
    ["User-Role Mapping", "Associate users with roles."],
    ["Role-Permission Mapping", "Associate roles with permissions."],
    ["Academic Data", "Store relevant attendance, timetable, subject, and academic information."],
    ["Referential Integrity", "Maintain valid relationships between related records."],
    ["Data Consistency", "Prevent invalid or inconsistent authorization relationships."],
])

heading(doc, "2.9 Security Requirements", 2)
caption(doc, "Table 2.6: Security Requirements", "tab_2_6")
make_table(doc, ["ID", "Requirement"], [
    ["SEC-01", "User credentials must be validated during authentication."],
    ["SEC-02", "JWT must be validated before protected resources are accessed."],
    ["SEC-03", "Authorization must be performed after authentication."],
    ["SEC-04", "Users must only access resources permitted to them."],
    ["SEC-05", "Unauthenticated requests to protected routes must be rejected."],
    ["SEC-06", "Users without required permissions must not access restricted resources."],
    ["SEC-07", "Authentication and authorization logic should remain reusable and structured."],
])

heading(doc, "2.10 System Constraints", 2)
caption(doc, "Table 2.7: System Constraints", "tab_2_7")
make_table(doc, ["Constraint", "Description"], [
    ["Backend Focus", "The project primarily focuses on the backend/API layer."],
    ["Database Dependency", "Academic and authorization information depends on the MySQL database."],
    ["Authentication Dependency", "Protected resources depend on successful authentication."],
    ["Authorization Dependency", "Access depends on role and permission mappings."],
    ["Data Dependency", "Attendance and academic operations depend on valid underlying data."],
    ["Deployment", "Production-scale deployment and infrastructure are outside the primary scope."],
])

# ============ CHAPTER 3 ============
heading(doc, "DIAGRAMS (E-R, DFD, USE CASE)", 1, 3)

heading(doc, "3.1 System Architecture", 2)
para(doc, "The system is designed around a centralized API gateway that provides a common interface for "
          "academic services.")
para(doc, "Every protected request passes through authentication and authorization checks before accessing "
          "application functionality.")
para(doc, "The overall request flow is:", False)
para(doc, "Client \u2192 API Gateway \u2192 Authentication \u2192 JWT Validation \u2192 RBAC/Permission "
          "Check \u2192 Application Logic \u2192 Database \u2192 Response", False)
insert_figure(doc, ASSETS / "architecture.png")
caption(doc, "Fig. 3.1 Overall System Architecture", "fig_3_1")

heading(doc, "3.2 Use Case Diagram", 2)
para(doc, "The use case diagram represents the interaction of the three primary system users with the "
          "attendance management system.")
para(doc, "Student: Login, View Profile, View Timetable, View Subjects, View Attendance.")
para(doc, "Teacher: Login, View Profile, View Timetable, View Subjects, Perform Authorized Attendance "
          "Operations.")
para(doc, "Administrator: Login, Manage Users, Manage Roles, Manage Permissions, Manage Access.")
para(doc, "All use cases are enclosed within the system boundary labelled \u201cBPIT Attendance Management "
          "System\u201d.")
insert_figure(doc, ASSETS / "usecase.png")
caption(doc, "Fig. 3.2 Use Case Diagram", "fig_3_2")

heading(doc, "3.3 Context-Level Data Flow Diagram", 2)
para(doc, "The Context-Level DFD represents the complete system as a single process, \u201cBPIT Attendance "
          "Management System\u201d, with three external entities: Student, Teacher, and Administrator. Data "
          "exchanged includes authentication requests, attendance requests, timetable requests, subject "
          "requests, user management requests, role and permission requests, and API responses. The "
          "downstream attendance microservice reached through the gateway proxy is also shown as an "
          "external system.")
insert_figure(doc, ASSETS / "context-dfd.png")
caption(doc, "Fig. 3.3 Context-Level Data Flow Diagram", "fig_3_3")

heading(doc, "3.4 Level-1 Data Flow Diagram", 2)
para(doc, "The Level-1 DFD decomposes the system into major processes: Authentication, JWT Verification, "
          "RBAC and Permission Authorization, Academic Services, and Database. Academic Services include "
          "attendance, timetable, subject, and user-related academic operations.")
insert_figure(doc, ASSETS / "level1-dfd.png")
caption(doc, "Fig. 3.4 Level-1 Data Flow Diagram", "fig_3_4")

heading(doc, "3.5 Entity Relationship Diagram", 2)
para(doc, "The ER diagram represents the relationships among the major database entities. The "
          "authorization structure follows USERS \u2192 USER_ROLES \u2192 ROLES \u2192 ROLE_PERMISSIONS "
          "\u2192 PERMISSIONS, implemented as Sequelize many-to-many associations. The academic entities "
          "SUBJECTS, TIMETABLE_SLOTS, and ATTENDANCE_RECORDS are related to USERS using the actual table "
          "names present in the project database.")
insert_figure(doc, ASSETS / "er.png")
caption(doc, "Fig. 3.5 Entity Relationship Diagram", "fig_3_5")

heading(doc, "3.6 Authentication and Authorization Flow", 2)
para(doc, "The authentication and authorization process can be represented as: the user submits a username "
          "and password; the authentication API validates the credentials against the MySQL database; a "
          "JWT is generated after successful authentication; the JWT is supplied with every subsequent "
          "protected request; the JWT middleware validates the token and the account status; and the RBAC/"
          "permission middleware verifies the required role and permission before the request reaches the "
          "controller. If authentication or authorization fails, the request is rejected.")
insert_figure(doc, ASSETS / "auth-flow.png")
caption(doc, "Fig. 3.6 Authentication and Authorization Flow", "fig_3_6")

heading(doc, "3.7 Attendance Management Workflow", 2)
para(doc, "The attendance management workflow consists of the following stages: user login, JWT "
          "authentication, identification of the user's role, verification of the required permission, "
          "validation of the attendance request against the academic catalogue, creation or update of the "
          "attendance record, and return of the API response.")
insert_figure(doc, ASSETS / "attendance-flow.png")
caption(doc, "Fig. 3.7 Attendance Management Workflow", "fig_3_7")

# ============ CHAPTER 4 ============
heading(doc, "PROCESS SELECTION (IMPLEMENTATION DETAILS WITH CODE)", 1, 4)

heading(doc, "4.1 Process Selection", 2)
para(doc, "The project follows an iterative backend development approach.")
para(doc, "The implementation began by understanding the existing attendance API and identifying areas "
          "requiring improvement. The authentication and authorization requirements were then analyzed, "
          "followed by the design of the user-role-permission structure.")
para(doc, "The major implementation stages were:", False)
for x in ["Understanding the existing backend.", "Identifying authentication requirements.",
          "Designing the user-role-permission model.", "Implementing authentication.",
          "Implementing JWT-based authentication.", "Implementing RBAC.",
          "Implementing permission checks.", "Protecting API routes.",
          "Connecting authorization relationships with the relational database.",
          "Integrating academic attendance functionality.", "Testing and validating the implementation."]:
    bullet(doc, x)

heading(doc, "4.2 Backend/API Implementation", 2)
para(doc, "The backend is implemented using Node.js and Express.js.")
para(doc, "The major logical components include API routes, authentication middleware, authorization "
          "middleware, application logic, database operations, and error handling. The separation of these "
          "responsibilities allows authentication and authorization logic to be reused across protected "
          "resources.")
caption(doc, "Table 4.1: Backend Modules and Responsibilities", "tab_4_1")
make_table(doc, ["Module", "Responsibility"], [
    ["Authentication", "Validates user identity and credentials"],
    ["JWT Management", "Maintains authenticated request identity"],
    ["Authorization", "Controls access to protected resources"],
    ["RBAC", "Associates users with roles"],
    ["Permission Management", "Associates permissions with roles"],
    ["User Management", "Maintains user information and relationships"],
    ["Attendance", "Handles attendance-related operations"],
    ["Timetable", "Provides timetable-related information"],
    ["Subject Management", "Provides subject-related information"],
    ["Database Layer", "Provides persistent storage"],
])

heading(doc, "4.3 Authentication Implementation", 2)
para(doc, "The authentication component verifies the credentials provided by a user.")
para(doc, "The authentication process consists of: the user submits a username and password; the backend "
          "receives the credentials; the credentials are validated using per-user salted scrypt password "
          "hashing; the corresponding user information is retrieved from the database; a JWT is generated "
          "after successful authentication; the token is returned to the client; and the token is used for "
          "subsequent protected requests.")
para(doc, "Authentication establishes the identity of a user. Authorization is subsequently used to "
          "determine whether that user is allowed to access a particular resource.")

heading(doc, "4.4 JWT-Based Authentication", 2)
para(doc, "JSON Web Token is used to maintain the authenticated identity of the user across API requests.")
para(doc, "The basic process is: Login Credentials \u2192 Authentication \u2192 JWT Generation \u2192 "
          "Protected Request \u2192 JWT Validation.")
para(doc, "The token carries the user id, username, email, roles, and permissions, is signed with HS256, "
          "is issuer-pinned to the gateway, and expires 30 minutes after issuance. For a protected request, "
          "the backend validates the JWT and confirms that the account is still active before allowing "
          "further processing.")
para(doc, "The use of JWT provides a token-based mechanism for authenticated communication between the "
          "client and the API gateway.")

heading(doc, "4.5 Role-Based Access Control", 2)
para(doc, "Role-Based Access Control is used to control access according to the role assigned to an "
          "authenticated user.")
para(doc, "The primary roles are Student, Teacher, and Administrator.")
para(doc, "The role determines the general category of access available to the user.")
para(doc, "RBAC avoids defining access independently for every user and provides a structured mechanism "
          "for managing permissions.")

heading(doc, "4.6 Permission Management", 2)
para(doc, "The authorization model includes a permission layer in addition to roles.")
para(doc, "The conceptual relationship is: User \u2192 Role \u2192 Permission \u2192 Resource.")
para(doc, "Permissions allow access control to become more granular. A user must have the required role "
          "and permission before accessing a protected resource.")
para(doc, "The implemented permission set consists of eight discrete permissions: view_users, edit_users, "
          "delete_users, view_profile, view_timetable, view_attendance, view_all_attendance, and "
          "manage_attendance. The Administrator role holds all eight permissions; the Teacher role holds "
          "view_users, view_profile, view_timetable, view_attendance, view_all_attendance, and "
          "manage_attendance; the Student role holds view_profile, view_timetable, and view_attendance.")
caption(doc, "Table 4.2: Role and Access Overview", "tab_4_2")
make_table(doc, ["Role", "Access Category"], [
    ["Student", "Personal academic, timetable, subject, and attendance resources"],
    ["Teacher", "Teacher-specific academic and authorized attendance resources"],
    ["Administrator", "User, role, permission, and administrative resources"],
])

heading(doc, "4.7 Protected Routes", 2)
para(doc, "Protected routes are API routes that require authentication and appropriate authorization "
          "before processing the request.")
para(doc, "The middleware flow is: Incoming Request \u2192 JWT Authentication \u2192 Identify User \u2192 "
          "Check Permission \u2192 Controller \u2192 Database \u2192 Response.")
para(doc, "If authentication fails, the request is rejected with an HTTP 401 response. If authentication "
          "succeeds but the user does not have the required permission, the request is rejected with an "
          "HTTP 403 response.")

heading(doc, "4.8 Relational User Schema", 2)
para(doc, "The project uses a relational representation for authorization information.")
para(doc, "Instead of storing users, roles, and permissions in one structure, these concepts are "
          "represented separately (users, roles, permissions, user_roles, role_permissions) and connected "
          "through Sequelize many-to-many associations.")
para(doc, "The conceptual structure is:", False)
para(doc, "Users \u2192 User-Roles \u2192 Roles \u2192 Role-Permissions \u2192 Permissions", False)
para(doc, "This approach provides:", False)
for x in ["Separation of concerns", "Reduced duplication", "Easier role management",
          "Easier permission management", "Improved maintainability", "Better extensibility",
          "Clearer database relationships"]:
    bullet(doc, x)

heading(doc, "4.9 Attendance Management", 2)
para(doc, "The attendance module provides functionality for academic attendance operations.")
para(doc, "Access to attendance resources is controlled through authentication and authorization.")
para(doc, "The general process is: authenticate the user; validate the JWT; identify the user's role; "
          "verify the required permission (manage_attendance to mark, view_attendance/view_all_attendance "
          "to read); validate the attendance request against the academic catalogue; perform the database "
          "operation; and return the API response.")
para(doc, "A submission for the same student, subject, and date updates the existing record in place "
          "rather than creating a duplicate, and attendance status is restricted to PRESENT, ABSENT, or "
          "LATE.")

heading(doc, "4.10 Timetable and Subject Management", 2)
para(doc, "The academic system includes timetable and subject-related information stored in the subjects "
          "and timetable_slots tables.")
para(doc, "Students can access relevant timetable and subject information as part of their academic "
          "resources. Teachers can access information relevant to their academic responsibilities and may "
          "request the timetable of any section, while a student's request always resolves to their own "
          "enrolled class.")
para(doc, "The API gateway controls access to these resources through the authentication and authorization "
          "mechanisms.")

heading(doc, "4.11 Validation and Error Handling", 2)
para(doc, "Validation ensures that API requests contain valid and complete information.")
para(doc, "The system handles conditions such as:", False)
for x in ["Invalid credentials", "Missing credentials", "Missing authentication token",
          "Invalid authentication token", "Insufficient permissions", "Invalid request data",
          "Missing required data", "Database-related errors", "Malformed JSON request bodies",
          "Unreachable downstream service (gateway proxy)"]:
    bullet(doc, x)
para(doc, "Appropriate HTTP responses are returned for unsuccessful requests: 400 for malformed or invalid "
          "input, 401 for missing or invalid authentication, 403 for insufficient authorization, 404 for "
          "unknown resources or routes, 409 for an academic conflict such as an unenrolled student, 502 "
          "when the downstream attendance service is unreachable, and 503 when the database is "
          "unavailable.")

heading(doc, "4.12 Frontend and User Interface", 2)
para(doc, "The project also provides a browser-based interface for interacting with the academic "
          "attendance functionality, served as static assets from the gateway.")
para(doc, "The interface provides role-based access to relevant functionality. Students can view academic "
          "and attendance information, teachers can perform authorized attendance operations, and "
          "administrators can access role and permission related functionality. The interface also "
          "provides attendance and timetable views for academic use.")
screenshot_placeholder(doc, "Student Dashboard")
screenshot_placeholder(doc, "Teacher Attendance Interface")
screenshot_placeholder(doc, "Administrator Interface")

heading(doc, "4.13 Code Implementation", 2)
para(doc, "The implementation uses Express.js middleware to process authentication and authorization "
          "before protected application logic is executed. The auth middleware verifies the bearer token "
          "and confirms the account is active; requirePermission and requireRole middleware then check the "
          "roles/permissions carried in the token before the controller runs.")
para(doc, "The protected request processing follows:", False)
insert_figure(doc, ASSETS / "api-flow.png")
caption(doc, "Fig. 4.2 API Request and Response Flow", "fig_4_2")
screenshot_placeholder(doc, "Backend Project Structure (folder tree)")
caption(doc, "Fig. 4.1 Backend Project Structure", "fig_4_1")
screenshot_placeholder(doc, "Authentication/Authorization Middleware Code (middlewares/auth.js)")

# ============ CHAPTER 5 ============
heading(doc, "RESULTS", 1, 5)

heading(doc, "5.1 Testing Methodology", 2)
para(doc, "Testing was performed to verify the correctness of authentication, authorization, role-based "
          "access, protected routes, and academic API operations.")
para(doc, "The testing process included:", False)
for x in ["Positive testing", "Negative testing", "Authentication testing", "JWT testing", "RBAC testing",
          "Permission testing", "Attendance testing", "Timetable testing", "Database validation",
          "Error handling"]:
    bullet(doc, x)
para(doc, "Postman was used for manual API testing and validation. In addition, the project includes an "
          "automated end-to-end smoke test (scripts/smoke-test.js, run using npm test) that starts the "
          "application on a test port and exercises real HTTP requests against every major workflow.")

heading(doc, "5.2 Authentication Testing", 2)
caption(doc, "Table 5.1: Authentication Test Cases", "tab_5_1")
make_table(doc, ["Test ID", "Test Scenario", "Expected Result"], [
    ["AUTH-01", "Valid username and password", "Authentication successful"],
    ["AUTH-02", "Invalid password", "Authentication rejected"],
    ["AUTH-03", "Invalid username", "Authentication rejected"],
    ["AUTH-04", "Missing credentials", "Request rejected"],
    ["AUTH-05", "Successful login", "JWT generated"],
    ["AUTH-06", "Protected request with valid JWT", "Request accepted if authorized"],
    ["AUTH-07", "Protected request without JWT", "Request rejected"],
    ["AUTH-08", "Invalid JWT", "Request rejected"],
])

heading(doc, "5.3 Authorization and RBAC Testing", 2)
caption(doc, "Table 5.2: RBAC Test Cases", "tab_5_2")
make_table(doc, ["Test ID", "Test Scenario", "Expected Result"], [
    ["RBAC-01", "Student accesses permitted student resource", "Access allowed"],
    ["RBAC-02", "Student accesses restricted administrative resource", "Access denied"],
    ["RBAC-03", "Teacher accesses permitted teacher resource", "Access allowed"],
    ["RBAC-04", "Teacher accesses restricted administrative resource", "Access denied"],
    ["RBAC-05", "Administrator accesses authorized resource", "Access allowed"],
    ["RBAC-06", "User without required authorization accesses protected resource", "Access denied"],
])

heading(doc, "5.4 Attendance Testing", 2)
caption(doc, "Table 5.3: Attendance Test Cases", "tab_5_3")
make_table(doc, ["Test ID", "Test Scenario", "Expected Result"], [
    ["ATT-01", "Authorized user requests attendance", "Attendance information returned"],
    ["ATT-02", "Unauthorized user requests restricted attendance", "Request denied"],
    ["ATT-03", "Valid attendance operation", "Operation completed successfully"],
    ["ATT-04", "Invalid attendance request", "Validation error returned"],
    ["ATT-05", "Required attendance data is missing", "Request rejected"],
    ["ATT-06", "Valid attendance record is stored", "Record persisted correctly"],
    ["ATT-07", "Duplicate attendance submission", "Existing record updated in place, not duplicated"],
])

heading(doc, "5.5 API Testing", 2)
para(doc, "API testing verifies that the implemented endpoints respond correctly under valid and invalid "
          "conditions.")
make_table(doc, ["Testing Category", "Purpose"], [
    ["Authentication Testing", "Verify user credential validation"],
    ["JWT Testing", "Verify token generation and validation"],
    ["Authorization Testing", "Verify permission-based access"],
    ["RBAC Testing", "Verify role-based restrictions"],
    ["Attendance Testing", "Verify attendance operations"],
    ["Timetable Testing", "Verify timetable access"],
    ["Database Testing", "Verify data storage and retrieval"],
    ["Error Testing", "Verify invalid request handling"],
])
screenshot_placeholder(doc, "Postman Testing / Terminal Output of npm test")
caption(doc, "Fig. 5.1 API Testing and Validation", "fig_5_1")
insert_figure(doc, ASSETS / "testing-flow.png", width=5.5)

heading(doc, "5.6 Database Validation", 2)
para(doc, "Database validation focuses on ensuring that:", False)
for x in ["User records are stored correctly.", "Roles are correctly represented.",
          "Users are correctly associated with roles.", "Roles are correctly associated with permissions.",
          "Academic records maintain valid relationships.",
          "Attendance data can be stored and retrieved correctly.",
          "Invalid authorization relationships are avoided."]:
    bullet(doc, x)

heading(doc, "5.7 Results Summary", 2)
para(doc, "The implemented system was tested across authentication, JWT validation, RBAC, permission "
          "checking, protected routes, attendance operations, timetable functionality, and database "
          "operations using the automated smoke test.")
para(doc, "The most recent smoke test run completed 83 checks, of which 78 passed and 5 failed. All "
          "authentication, account lifecycle, gateway proxy, timetable/enrolment, and administrative "
          "checks passed. The failing checks were concentrated in student-side authorization boundaries:")
for x in ["A STUDENT account was able to mark attendance (expected: 403 Forbidden, actual: 201 Created).",
          "A STUDENT could retrieve attendance records beyond their own (expected: only own records).",
          "A STUDENT was able to read another student's attendance records (expected: 403 Forbidden).",
          "A STUDENT requesting another class's timetable still received their own instead of being "
          "rejected outright, indicating the guard needs to be stricter.",
          "A STUDENT was able to open a class roster intended for teachers (expected: 403 Forbidden, "
          "actual: 200 OK)."]:
    bullet(doc, x)
para(doc, "These failures indicate that a small number of student-facing routes are not yet enforcing the "
          "manage_attendance / view_all_attendance permission boundary as strictly as the Role-Permission "
          "matrix intends, even though the requirePermission middleware itself is implemented correctly for "
          "the majority of routes. This is recorded transparently as an identified issue rather than "
          "presenting the prototype as fully production-ready.")
caption(doc, "Table 5.4: Testing Summary", "tab_5_4")
make_table(doc, ["Testing Area", "Result"], [
    ["Authentication", "Pass"],
    ["JWT Validation", "Pass"],
    ["RBAC (Teacher / Administrator boundaries)", "Pass"],
    ["RBAC (Student boundaries)", "Partial - 5 checks failed (see above)"],
    ["Permission Checking", "Pass, with the exceptions noted above"],
    ["Protected Routes", "Pass"],
    ["Attendance APIs", "Pass, with the exceptions noted above"],
    ["Timetable APIs", "Pass, with one exception noted above"],
    ["Account Lifecycle (deactivation/reactivation/deletion)", "Pass"],
    ["Gateway Proxy Error Handling", "Pass"],
    ["Database Operations", "Pass"],
    ["Overall HTTP Smoke Test", "78 passed, 5 failed (83 total checks)"],
])
para(doc, "The results demonstrate that the authentication and authorization architecture can distinguish "
          "between authenticated and unauthenticated requests and can, for the large majority of routes, "
          "restrict access according to the defined roles and permissions. The identified student-side "
          "authorization gaps are treated as a priority correction for the next development cycle.")

# ============ CHAPTER 6 ============
heading(doc, "COMPARISONS & ANALYSIS", 1, 6)

heading(doc, "6.1 Existing and Proposed System", 2)
caption(doc, "Table 6.1: Existing and Proposed System Comparison", "tab_6_1")
make_table(doc, ["Feature", "Existing System", "Enhanced System"], [
    ["Backend", "Express.js API", "Express.js API with structured security layer"],
    ["Database", "MySQL", "MySQL with authorization relationships"],
    ["Authentication", "Microsoft (Azure AD) sign-in only",
     "Microsoft sign-in retained, plus username/password authentication with JWT"],
    ["Role Handling", "Limited", "Student, Teacher, Administrator"],
    ["Authorization", "Limited role handling", "RBAC and permissions"],
    ["Permission Management", "Limited", "Dedicated permission model (8 discrete permissions)"],
    ["Protected Routes", "Limited", "Authentication and authorization protected"],
    ["User Schema", "Basic", "Scalable relational structure"],
    ["Extensibility", "Limited", "Improved through roles and permissions"],
])

heading(doc, "6.2 Authentication Analysis", 2)
para(doc, "Authentication and authorization perform different functions in the system.")
para(doc, "Authentication determines the identity of the user, whereas authorization determines the "
          "resources and operations that the authenticated user is allowed to access.")
para(doc, "The enhanced authentication flow uses username/password credentials, or the existing Microsoft "
          "sign-in, followed by JWT-based authenticated requests, so that every downstream request is "
          "evaluated against one common token format regardless of how the user originally signed in.")
para(doc, "The separation can therefore be represented as: Who is the user? \u2192 Authentication. What is "
          "the user allowed to do? \u2192 Authorization.")

heading(doc, "6.3 RBAC Analysis", 2)
para(doc, "Role-Based Access Control simplifies authorization by grouping permissions according to roles.")
para(doc, "The authorization structure is: User \u2192 Role \u2192 Permissions \u2192 Resource.")
para(doc, "This reduces the need to define access independently for every user and provides a convenient "
          "mechanism for extending the system when additional roles are required.")

heading(doc, "6.4 Database Design Analysis", 2)
para(doc, "The separation of users, roles, and permissions provides a structured relational design.")
para(doc, "The main advantages are:", False)
for x in ["Reduced duplication", "Better normalization", "Easier role management",
          "Easier permission management", "Improved maintainability", "Better scalability",
          "Clearer relationships"]:
    bullet(doc, x)
para(doc, "The relational approach also makes authorization information easier to query and manage.")

heading(doc, "6.5 API Architecture Analysis", 2)
para(doc, "The API gateway provides a common entry point for backend operations, including a proxy to a "
          "downstream attendance microservice for requests that must be forwarded rather than handled "
          "locally.")
para(doc, "A centralized middleware-based approach allows authentication and authorization to be applied "
          "consistently across protected routes.")
para(doc, "The general architecture is: Request \u2192 Authentication \u2192 Authorization \u2192 "
          "Application Logic \u2192 Database \u2192 Response.")
para(doc, "This structure improves code organization and makes security concerns easier to maintain.")

heading(doc, "6.6 Security Analysis", 2)
para(doc, "The security architecture uses multiple stages: Credential Validation \u2192 JWT Authentication "
          "\u2192 User Identification \u2192 Role Verification \u2192 Permission Verification \u2192 "
          "Protected Resource.")
para(doc, "This layered approach ensures that successful authentication alone does not automatically "
          "provide access to every resource. The smoke test results in Chapter 5 confirm this holds for "
          "teacher and administrator boundaries, while highlighting that a small number of student-facing "
          "routes still need correction to fully enforce it.")

heading(doc, "6.7 Challenges and Solutions", 2)
para(doc, "Challenge 1: Designing a Flexible Authorization Model", False)
para(doc, "A simple role field may become restrictive as an application grows.")
para(doc, "Solution: A separate role and permission model was introduced so that access can be managed "
          "more flexibly.")
para(doc, "Challenge 2: Protecting API Routes", False)
para(doc, "Sensitive API routes require appropriate security checks.")
para(doc, "Solution: Reusable authentication and authorization middleware was used to protect routes.")
para(doc, "Challenge 3: Separating Authentication and Authorization", False)
para(doc, "A successfully authenticated user should not automatically have access to every resource.")
para(doc, "Solution: JWT authentication and RBAC/permission verification were implemented as separate "
          "stages.")
para(doc, "Challenge 4: Managing User Relationships", False)
para(doc, "User access depends on relationships between users, roles, and permissions.")
para(doc, "Solution: A relational user-role-permission structure was introduced.")
para(doc, "Challenge 5: Testing Multiple Access Levels", False)
para(doc, "Different roles require different levels of access.")
para(doc, "Solution: API requests were tested under different roles and authorization conditions using an "
          "automated smoke test, which is how the residual student-authorization gaps described in Chapter "
          "5 were identified.")

heading(doc, "6.8 Limitations", 2)
for x in ["The primary implementation focuses on the backend/API and academic management functionality.",
          "The system depends on correctly configured database relationships.",
          "Authentication and authorization depend on secure handling of credentials and JWTs.",
          "Automated testing identified five student-side authorization checks that do not yet fully "
          "enforce the intended permission boundary (attendance marking, own-record scoping, and class "
          "roster access); these require correction before the system can be considered production-ready.",
          "Production-scale deployment and performance testing are outside the primary implementation.",
          "Advanced monitoring and audit functionality can be introduced in future versions."]:
    bullet(doc, x)

# ============ CHAPTER 7 ============
heading(doc, "CONCLUSIONS & FUTURE SCOPE", 1, 7)

heading(doc, "7.1 Conclusion", 2)
para(doc, "The BPIT API Gateway Based Attendance Management System demonstrates the development of a "
          "structured backend API for an academic attendance and timetable management environment.")
para(doc, "The project was developed from an existing Express.js and MySQL based attendance API foundation "
          "and enhanced with a structured authentication and authorization architecture.")
para(doc, "The major technical contributions include:", False)
for x in ["Username/password authentication alongside the existing Microsoft sign-in",
          "JWT-based authentication", "Role-Based Access Control", "Permission-based authorization",
          "Protected API routes", "Student, Teacher, and Administrator roles",
          "Relational user-role-permission schema", "Attendance-related API operations",
          "Timetable and subject-related academic information"]:
    bullet(doc, x)
para(doc, "The implementation demonstrates the importance of separating authentication from authorization "
          "and using a structured relational model for users, roles, and permissions.")
para(doc, "The project also provided practical experience in Node.js, Express.js, REST API development, "
          "MySQL database design, JWT authentication, middleware, RBAC, permission management, API "
          "testing, debugging, and technical documentation.")
para(doc, "Overall, the project provides a more organized, maintainable, and extensible foundation for an "
          "academic attendance management system, with the automated smoke test results providing a clear, "
          "honest baseline of what is complete and what still requires correction.")

heading(doc, "7.2 Learning Outcomes", 2)
para(doc, "The training provided significant technical and professional learning.")
para(doc, "The major technical learning outcomes include:", False)
for x in ["Understanding Node.js backend development.", "Working with Express.js.", "Designing REST APIs.",
          "Understanding Express middleware.", "Implementing authentication.", "Understanding JWT.",
          "Implementing Role-Based Access Control.", "Implementing permission-based authorization.",
          "Designing relational database structures.", "Working with MySQL.",
          "Testing APIs using Postman.", "Implementing protected routes.",
          "Debugging backend applications.", "Understanding secure API design.",
          "Understanding software documentation and testing practices."]:
    bullet(doc, x)
para(doc, "The training also strengthened skills in requirement analysis, system design, database design, "
          "modular architecture, error handling, and security-oriented development.")

heading(doc, "7.3 Future Scope", 2)
para(doc, "The system can be extended in several directions.")

heading(doc, "Complete Frontend", 3)
para(doc, "A more comprehensive responsive interface can be developed for students, teachers, and "
          "administrators.")
for x in ["Student dashboard", "Teacher dashboard", "Administrator dashboard", "Attendance views",
          "Timetable views", "Subject information", "Role and permission management"]:
    bullet(doc, x)

heading(doc, "Advanced Attendance Analytics", 3)
for x in ["Subject-wise attendance percentages", "Weekly attendance trends", "Monthly attendance trends",
          "Low-attendance alerts", "Attendance summaries", "Attendance reports"]:
    bullet(doc, x)

heading(doc, "Advanced Administration", 3)
for x in ["User creation", "User deactivation", "Role assignment", "Permission assignment",
          "Access history", "Audit logging"]:
    bullet(doc, x)

heading(doc, "Enhanced Security", 3)
for x in ["Refresh tokens", "Password reset", "Multi-factor authentication",
          "Improved token lifecycle management", "Rate limiting", "Security logging",
          "Advanced input validation", "Closing the residual student-authorization gaps identified in "
          "Chapter 5 with regression tests for every such boundary"]:
    bullet(doc, x)

heading(doc, "API Documentation", 3)
para(doc, "Interactive API documentation can be introduced using OpenAPI/Swagger to make the API easier to "
          "understand, test, and maintain.")

heading(doc, "Deployment and Scalability", 3)
for x in ["Cloud deployment", "Containerization", "Automated deployment", "Centralized logging",
          "Monitoring", "Load testing", "Database optimization"]:
    bullet(doc, x)
para(doc, "These improvements can provide a foundation for transforming the project into a larger "
          "production-ready academic management platform.")

# ============ CHAPTER 8 ============
heading(doc, "REFERENCES", 1, 8)
for ref in [
    "Node.js Foundation, \u201cNode.js Documentation.\u201d https://nodejs.org/en/docs/",
    "Express.js, \u201cExpress.js Documentation.\u201d https://expressjs.com/",
    "Oracle, \u201cMySQL Reference Manual.\u201d https://dev.mysql.com/doc/",
    "Sequelize, \u201cSequelize Documentation.\u201d https://sequelize.org/",
    "M. Jones, J. Bradley, and N. Sakimura, \u201cJSON Web Token (JWT),\u201d RFC 7519, Internet "
    "Engineering Task Force. https://www.rfc-editor.org/rfc/rfc7519",
    "OpenID Foundation / node-jose maintainers, \u201cJOSE (JavaScript Object Signing and Encryption) "
    "Documentation.\u201d https://github.com/panva/jose",
    "OWASP Foundation, \u201cOWASP Application Security Verification Standard.\u201d https://owasp.org/"
    "www-project-application-security-verification-standard/",
    "Mozilla Developer Network, \u201cHTTP and Web Development Documentation.\u201d "
    "https://developer.mozilla.org/",
    "Postman, \u201cPostman API Platform Documentation.\u201d https://learning.postman.com/",
]:
    para(doc, ref, False)

# ============ APPENDICES ============
heading(doc, "APPENDIX A", 1)
center("API DOCUMENTATION", 14, True)
para(doc, "The API documentation below reflects the endpoints implemented in the project (routes/auth.js, "
          "routes/attendance.js, routes/academic.js, routes/attendance_service_routes.js, server.js).",
     False)
caption(doc, "Table A.1: API Endpoint Documentation", "tab_a_1")
make_table(doc, ["S.No.", "Endpoint", "Method", "Auth", "Authorization", "Purpose"], [
    ["1", "/health", "GET", "No", "-", "Report database connectivity/health status"],
    ["2", "/auth/microsoft", "POST", "No", "-", "Authenticate via Microsoft (Azure AD) token"],
    ["3", "/auth/register", "POST", "No", "-", "Create a local username/password account"],
    ["4", "/auth/login", "POST", "No", "-", "Authenticate with username/password, issue JWT"],
    ["5", "/auth/me", "GET", "Yes", "Any authenticated user", "Return the current user's profile"],
    ["6", "/auth/roles", "GET", "Yes", "view_users", "List roles and their permission matrix"],
    ["7", "/auth/users", "GET", "Yes", "view_users", "List users (paginated)"],
    ["8", "/auth/users/:userId/roles", "POST", "Yes", "edit_users", "Assign/replace a user's role"],
    ["9", "/auth/users/:userId/status", "PATCH", "Yes", "delete_users", "Activate/deactivate a user"],
    ["10", "/auth/users/:userId", "DELETE", "Yes", "delete_users", "Delete a user"],
    ["11", "/api/attendance", "GET", "Yes", "view_attendance", "List attendance records"],
    ["12", "/api/attendance", "POST", "Yes", "manage_attendance", "Mark/update one student's attendance"],
    ["13", "/api/attendance/bulk", "POST", "Yes", "manage_attendance", "Mark attendance for a class"],
    ["14", "/api/academic/meta", "GET", "Yes", "Any authenticated user", "List branches/sections catalogue"],
    ["15", "/api/academic/classes", "GET", "Yes", "view_timetable", "List classes"],
    ["16", "/api/academic/enrol", "POST", "Yes", "Any authenticated user", "Save a student's enrolment"],
    ["17", "/api/academic/timetable", "GET", "Yes", "view_timetable", "Retrieve a class timetable"],
    ["18", "/api/academic/subjects", "GET", "Yes", "view_timetable", "Retrieve subjects for a branch"],
    ["19", "/api/academic/attendance/summary", "GET", "Yes", "view_attendance",
     "Per-subject attendance summary for a student"],
    ["20", "/api/academic/attendance/class", "GET", "Yes", "view_all_attendance",
     "Class roster with attendance percentages"],
    ["21", "/attendance_service/*", "Proxy (GET/POST)", "Yes", "Any authenticated user",
     "Forward request to the downstream attendance microservice"],
], col_widths=[0.4, 1.7, 0.9, 0.5, 1.1, 1.9])

for ep, method, auth_req, authz, req, resp, err in [
    ("/auth/login", "POST", "No",
     "None (public)",
     '{ "username": "<username>", "password": "<password>" }',
     '{ "token": "<JWT>", "user": { "id", "username", "email", "roles", "permissions" } }',
     '401 { "error": "Invalid username or password" }'),
    ("/api/attendance", "POST", "Yes",
     "manage_attendance",
     '{ "userId": <id>, "subjectCode": "PPS", "date": "YYYY-MM-DD", "status": "PRESENT|ABSENT|LATE" }',
     '201 { "message": "Attendance marked successfully", "record": { ... } }',
     '403 { "error": "Forbidden: missing permission", "required": ["manage_attendance"] }'),
    ("/api/academic/timetable", "GET", "Yes",
     "view_timetable",
     "Query params (optional, teacher/admin only): branch, section, semester, batch",
     '{ "branch", "section", "semester", "days": [ ... periods ... ] }',
     '409 { "error": "Not enrolled yet", "code": "NOT_ENROLLED" }'),
    ("/auth/users/:userId/roles", "POST", "Yes",
     "edit_users",
     '{ "role": "TEACHER" }',
     '{ "message": "Role updated", "user": { ... } }',
     '404 { "error": "User not found" }'),
]:
    heading(doc, f"Endpoint: {method} {ep}", 3)
    para(doc, f"Authentication required: {auth_req}", False)
    para(doc, f"Authorization required: {authz}", False)
    para(doc, f"Request: {req}", False)
    para(doc, f"Response: {resp}", False)
    para(doc, f"Error Response (example): {err}", False)

heading(doc, "APPENDIX B", 1)
center("DATABASE / DATA DICTIONARY", 14, True)
para(doc, "The tables below reflect the actual Sequelize models in db/models/.", False)
caption(doc, "Table B.1: Database/Data Dictionary", "tab_b_1")
make_table(doc, ["Table", "Attribute", "Description", "Data Type"], [
    ["users", "id", "Primary key", "INTEGER (PK, auto-increment)"],
    ["users", "username", "Unique login name", "STRING(150)"],
    ["users", "email", "Unique email address", "STRING(255)"],
    ["users", "passwordHash", "Salted scrypt hash of the local password", "STRING(255)"],
    ["users", "name", "Display name", "STRING(150)"],
    ["users", "oid", "Microsoft account object id", "STRING(64), unique"],
    ["users", "authProvider", "How the account signs in", "ENUM(local, microsoft)"],
    ["users", "isActive", "Whether the account can authenticate", "BOOLEAN"],
    ["users", "lastLoggedIn", "Last successful login timestamp", "DATE"],
    ["users", "enrolmentNumber", "Student enrolment number", "STRING(20), unique"],
    ["users", "branch / section / semester / year / batch", "Academic enrolment context", "STRING/INTEGER"],
    ["roles", "id, name, description", "Role identity (ADMIN, TEACHER, STUDENT)", "INTEGER / STRING(50) / STRING(255)"],
    ["permissions", "id, name, description", "Permission identity (e.g. manage_attendance)", "INTEGER / STRING / STRING"],
    ["user_roles", "userId, roleId", "Join table: user-to-role mapping", "INTEGER (FK, FK)"],
    ["role_permissions", "roleId, permissionId", "Join table: role-to-permission mapping", "INTEGER (FK, FK)"],
    ["subjects", "id, code, name, branch, semester", "Subject catalogue entry", "INTEGER / STRING(12) / STRING(120) / STRING(16) / INTEGER"],
    ["subjects", "theoryFaculty, labFaculty, countsForAttendance", "Faculty and attendance eligibility", "STRING(120) / STRING(120) / BOOLEAN"],
    ["timetable_slots", "id, branch, section, semester, day, period", "One timetable period", "INTEGER / STRING / STRING / INTEGER / ENUM / INTEGER"],
    ["timetable_slots", "subjectCode, type, batch, room, faculty", "Slot content", "STRING(12) / ENUM(THEORY, LAB, LIBRARY, ENRICHMENT) / STRING(4) / STRING(16) / STRING(160)"],
    ["attendance_records", "id, subject, subjectCode", "Record identity and subject reference", "INTEGER / STRING(150) / STRING(12)"],
    ["attendance_records", "branch, section, semester", "Class context at the time of marking", "STRING(16) / STRING(4) / INTEGER"],
    ["attendance_records", "date, status", "Attendance date and outcome", "DATEONLY / ENUM(PRESENT, ABSENT, LATE)"],
    ["attendance_records", "markedBy, notes", "Teacher who marked it, optional note", "INTEGER / STRING(255)"],
], col_widths=[1.1, 1.6, 2.2, 1.6])

heading(doc, "APPENDIX C", 1)
center("SCREENSHOTS", 14, True)
para(doc, "The following screenshots should be captured from the actual running application before final "
          "submission.", False)
for label in ["C.1 Login Page", "C.2 Student Dashboard", "C.3 Student Timetable",
              "C.4 Student Attendance View", "C.5 Teacher Dashboard",
              "C.6 Teacher Attendance Management", "C.7 Administrator Dashboard",
              "C.8 Role and Permission Management", "C.9 Postman API Testing / npm test Output",
              "C.10 Protected API Request", "C.11 Database Records", "C.12 Attendance/Timetable Data"]:
    heading(doc, label, 3)
    screenshot_placeholder(doc, label)

# TOC field at the very top would normally be inserted before content; instead we insert
# the auto-updating TOC field into the placeholder paragraph created earlier.
doc.core_properties.author = "Vidhatri Nautiyal"
doc.core_properties.title = "BPIT API Gateway Based Attendance Management System"
try:
    doc.save(OUT)
    print(OUT)
except PermissionError:
    alt = OUT.with_stem(OUT.stem + "_v2")
    doc.save(alt)
    print(f"NOTE: {OUT.name} is locked (likely open in Word) - saved to {alt} instead")

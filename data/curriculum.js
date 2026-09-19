/**
 * First-year (Semester 1) curriculum for 2026-27, transcribed from
 * "First Year Time Table (Odd Semester : 2026-27)", w.e.f. 24-08-2026.
 *
 * This file is the single source of truth for sections, subjects, faculty and
 * the weekly timetable. Correct it here and re-run `npm run seed` -- nothing
 * else needs to change.
 */

// Period grid shared by every section.
const PERIODS = [
    { period: 1, label: "I", start: "09:30", end: "10:20" },
    { period: 2, label: "II", start: "10:20", end: "11:10" },
    { period: 3, label: "III", start: "11:10", end: "12:00" },
    { period: 4, label: "IV", start: "12:00", end: "12:50" },
    { period: 5, label: "V", start: "13:40", end: "14:30" },
    { period: 6, label: "VI", start: "14:30", end: "15:20" },
    { period: 7, label: "VII", start: "15:20", end: "16:10" },
    { period: 8, label: "VIII", start: "16:10", end: "17:00" }
];

const LUNCH = { start: "12:50", end: "13:40" };

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

// Subject master. Codes are the ones printed on the timetable.
const SUBJECTS = {
    "PPS": "Programming for Problem Solving",
    "BEE": "Basics of Electrical Engineering",
    "EP-I": "Engineering Physics-I",
    "EVS": "Environmental Studies",
    "EM": "Engineering Mechanics",
    "SMT-1": "System Modeling Techniques-I",
    "EG-I": "Engineering Graphics-I",
    "HVE": "Human Values and Ethics",
    "PDP": "Personality Development Programme",
    "DECO": "Digital Electronics and Computer Organization",
    "CS": "Communication Skills",
    // EEE follows a different first-year scheme
    "AM-I": "Applied Mathematics-I",
    "ES": "Electrical Science",
    "AP-I": "Applied Physics-I",
    "AC": "Applied Chemistry",
    "MP": "Manufacturing Process",
    // Non-teaching slots that still occupy the grid
    "LIB": "Library",
    "ENR": "Enrichment Activities / Mentorship Programme"
};

// Subjects that are not marked for attendance.
const NON_ACADEMIC = ["LIB", "ENR", "PDP"];

/**
 * Timetable notation, one string per period (8 per day):
 *   "PPS"                          -> theory for the whole class
 *   "LAB:G1=PPS@108A,G2=EG-I@8"    -> parallel batch labs, room in brackets
 *   "~"                            -> continuation of the previous period
 *   "ENR" / "LIB"                  -> non-teaching slot
 *   "-"                            -> free period
 */
const SECTIONS = [
    {
        branch: "CSE", section: "A", room: "103",
        faculty: {
            "PPS": { theory: "Demo Faculty", lab: "Demo Faculty" },
            "BEE": { theory: "Dr. Shikha", lab: "Dr. Shikha" },
            "EP-I": { theory: "Dr. Umang Sharma", lab: "Prof. Deepika Sandil" },
            "EVS": { theory: "Dr. Priya Takkar", lab: "Dr. Priya Takkar" },
            "EM": { theory: "Mr. Pradeep Kumar" },
            "SMT-1": { theory: "Dr. Gunjan Goyal" },
            "EG-I": { theory: "Ms. Nikita Bhardwaj", lab: "Mr. Pradeep Kumar" },
            "HVE": { theory: "Ms. Nikita Bhardwaj" },
            "PDP": { theory: "Ms. Nikita Bhardwaj" }
        },
        timetable: {
            MONDAY: ["SMT-1", "PPS", "HVE", "EVS", "LAB:G1=EG-I@8,G2=EP-I@101", "~", "LAB:G1=BEE@202,G2=LIB", "~"],
            TUESDAY: ["LAB:G1=PPS@108A,G2=EG-I@8", "~", "BEE", "LIB", "EP-I", "ENR", "~", "~"],
            WEDNESDAY: ["EP-I", "EM", "PPS", "SMT-1", "LAB:G1=LIB,G2=BEE@202", "~", "ENR", "~"],
            THURSDAY: ["EVS", "HVE", "EM", "SMT-1", "EP-I", "BEE", "LAB:G1=EP-I@101,G2=EVS@116", "~"],
            FRIDAY: ["PPS", "EM", "PDP", "BEE", "LAB:G1=EVS@116,G2=PPS@108A", "~", "ENR", "~"]
        }
    },
    {
        branch: "CSE", section: "B", room: "104",
        faculty: {
            "PPS": { theory: "Demo Faculty", lab: "Demo Faculty" },
            "BEE": { theory: "Mr. H K Rajput", lab: "Mr. H K Rajput" },
            "EP-I": { theory: "Dr. Umang Sharma", lab: "Prof. Deepika Sandil (G1) / Dr. Umang Sharma (G2)" },
            "EVS": { theory: "Dr. Priya Takkar", lab: "Dr. Priya Takkar" },
            "EM": { theory: "Mr. Dharamvir Dixit" },
            "SMT-1": { theory: "Dr. Gunjan Goyal" },
            "EG-I": { theory: "Ms. Nikita Bhardwaj", lab: "Mr. Dharamvir Dixit" },
            "HVE": { theory: "Ms. Nikita Bhardwaj" },
            "PDP": { theory: "Ms. Nikita Bhardwaj" }
        },
        timetable: {
            MONDAY: ["LAB:G1=EVS@116,G2=EP-I@101", "~", "LAB:G1=BEE@202,G2=PPS@108C", "~", "PPS", "ENR", "~", "~"],
            TUESDAY: ["BEE", "EM", "EP-I", "HVE", "EVS", "LIB", "LAB:G1=EG-I@8,G2=BEE@202", "~"],
            WEDNESDAY: ["PPS", "BEE", "LIB", "EM", "SMT-1", "ENR", "~", "~"],
            THURSDAY: ["HVE", "EP-I", "LAB:G1=PPS@108B,G2=EG-I@8", "~", "SMT-1", "EM", "LAB:G1=EP-I@101,G2=EVS@116", "~"],
            FRIDAY: ["EVS", "BEE", "PPS", "SMT-1", "EP-I", "PDP", "ENR", "~"]
        }
    },
    {
        branch: "CSE", section: "C", room: "112",
        faculty: {
            "PPS": { theory: "Dr. Bhawna Suri", lab: "Dr. Bhawna Suri" },
            "BEE": { theory: "Mr. Prashant", lab: "Mr. Prashant" },
            "EP-I": { theory: "Dr. Umang Sharma", lab: "Dr. Umang Sharma" },
            "EVS": { theory: "Dr. Priya Takkar", lab: "Dr. Priya Takkar" },
            "EM": { theory: "Mr. Dharamvir Dixit" },
            "SMT-1": { theory: "Dr. Gunjan Goyal" },
            "EG-I": { theory: "Ms. Nikita Bhardwaj", lab: "Dr. Neeta Sharma" },
            "HVE": { theory: "Ms. Nikita Bhardwaj" },
            "PDP": { theory: "Ms. Nikita Bhardwaj" }
        },
        timetable: {
            MONDAY: ["PPS", "EM", "BEE", "EP-I", "EVS", "PDP", "LAB:G1=EG-I@8,G2=PPS@108C", "~"],
            TUESDAY: ["EP-I", "BEE", "LAB:G1=BEE@202,G2=EVS@116", "~", "SMT-1", "LIB", "LAB:G1=PPS@108C,G2=LIB", "~"],
            WEDNESDAY: ["BEE", "HVE", "EVS", "EP-I", "LAB:G1=EP-I@101,G2=EG-I@8", "~", "ENR", "~"],
            THURSDAY: ["EM", "SMT-1", "LAB:G1=EVS@116,G2=BEE@202", "~", "HVE", "PPS", "ENR", "~"],
            FRIDAY: ["SMT-1", "PPS", "LAB:G1=LIB,G2=EP-I@101", "~", "EM", "ENR", "~", "~"]
        }
    },
    {
        branch: "IT", section: "A", room: "304",
        faculty: {
            "PPS": { theory: "Ms. Aditi Dwivedi", lab: "Ms. Aditi Dwivedi" },
            "DECO": { theory: "Dr. Pavika Sharma", lab: "Dr. Pavika Sharma" },
            "EP-I": { theory: "Dr. Arvind Sharma", lab: "Dr. Sugandha Gupta (G1) / Prof. Deepika Sandil (G2)" },
            "EVS": { theory: "Dr. Liza Sharma", lab: "Dr. Liza Sharma" },
            "EM": { theory: "Mr. Pardeep Sharma" },
            "SMT-1": { theory: "Prof. Arunima Kumari" },
            "EG-I": { theory: "Mr. Pardeep Sharma" },
            "CS": { theory: "Dr. Reema Chaudhary" },
            "PDP": { theory: "Dr. Reema Chaudhary" }
        },
        timetable: {
            MONDAY: ["EM", "SMT-1", "EP-I", "LIB", "LAB:G1=EVS@116,G2=LIB", "~", "LAB:G1=DECO@307,G2=ENR", "~"],
            TUESDAY: ["CS", "SMT-1", "LAB:G1=EG-I@8,G2=EP-I@101", "~", "DECO", "EVS", "LAB:G1=PPS@102B,G2=ENR", "~"],
            WEDNESDAY: ["LIB", "EP-I", "CS", "SMT-1", "PPS", "DECO", "LAB:G1=DECO@307,G2=PPS@102B", "~"],
            THURSDAY: ["EVS", "CS", "PPS", "EM", "LAB:G1=EP-I@101,G2=EG-I@8", "~", "ENR", "~"],
            FRIDAY: ["LAB:G1=LIB,G2=EVS@116", "~", "DECO", "EP-I", "PPS", "EM", "PDP", "LIB"]
        }
    },
    {
        branch: "IT", section: "B", room: "309",
        faculty: {
            "PPS": { theory: "Dr. Priyanka Singla", lab: "Dr. Priyanka Singla" },
            "DECO": { theory: "Ms. Monika Kaushik", lab: "Ms. Monika Kaushik" },
            "EP-I": { theory: "Dr. Sugandha Gupta", lab: "Dr. Sugandha Gupta" },
            "EVS": { theory: "Dr. Liza Sarma", lab: "Dr. Liza Sarma" },
            "EM": { theory: "Dr. Rajesh Kumar" },
            "SMT-1": { theory: "Prof. Arunima Kumari" },
            "EG-I": { theory: "Dr. Rajesh Kumar" },
            "CS": { theory: "Dr. Reema Chaudhary" },
            "PDP": { theory: "Dr. Reema Chaudhary" }
        },
        timetable: {
            MONDAY: ["EM", "EVS", "LAB:G1=EVS@116,G2=DECO@307", "~", "DECO", "LIB", "LAB:G1=PPS@102C,G2=DECO@307", "~"],
            TUESDAY: ["LAB:G1=DECO@307,G2=EVS@116", "~", "EP-I", "SMT-1", "LAB:G1=EP-I@101,G2=EG-I@8", "~", "ENR", "~"],
            WEDNESDAY: ["CS", "SMT-1", "EM", "LIB", "PPS", "PDP", "LAB:G1=PPS@102C,G2=EG-I@8", "~"],
            THURSDAY: ["EP-I", "SMT-1", "EVS", "CS", "PPS", "DECO", "ENR", "~"],
            FRIDAY: ["DECO", "EM", "CS", "PPS", "EP-I", "ENR", "~", "~"]
        }
    },
    {
        branch: "IT", section: "C", room: "310",
        faculty: {
            "PPS": { theory: "Ms. Vidhu Jain", lab: "Ms. Vidhu Jain" },
            "DECO": { theory: "Dr. Kirti Dalal", lab: "Dr. Kirti Dalal" },
            "EP-I": { theory: "Dr. Sugandha Gupta", lab: "Dr. Sugandha Gupta" },
            "EVS": { theory: "Dr. Liza Sarma", lab: "Dr. Liza Sarma (G1) / Dr. Komal Mehra (G2)" },
            "EM": { theory: "Dr. Pooja Rani" },
            "SMT-1": { theory: "Prof. Arunima Kumari" },
            "EG-I": { theory: "Dr. Pooja Rani" },
            "CS": { theory: "Dr. Reema Chaudhary" },
            "PDP": { theory: "Dr. Reema Chaudhary" }
        },
        timetable: {
            MONDAY: ["LAB:G1=LIB,G2=DECO@307", "~", "SMT-1", "DECO", "PPS", "LIB", "LAB:G1=EP-I@101,G2=PPS@102A", "~"],
            TUESDAY: ["PPS", "EM", "CS", "DECO", "ENR", "~", "~", "~"],
            WEDNESDAY: ["DECO", "EVS", "LAB:G1=EP-I@101,G2=EG-I@8", "~", "EP-I", "EM", "LAB:G1=EVS@116,G2=PPS@102A", "~"],
            THURSDAY: ["LAB:G1=DECO@307,G2=EVS@116", "~", "EP-I", "SMT-1", "CS", "EVS", "ENR", "~"],
            FRIDAY: ["EP-I", "SMT-1", "EM", "CS", "PPS", "PDP", "LAB:G1=EG-I@8,G2=LIB", "~"]
        }
    },
    {
        branch: "ECE", section: "A", room: "311",
        faculty: {
            "PPS": { theory: "Ms. Suman Sehrawat", lab: "Ms. Suman Sehrawat" },
            "DECO": { theory: "Prof. Anuradha Bhattacharjee", lab: "Mr. Risheek Kumar" },
            "EP-I": { theory: "Dr. Kavita Segwal", lab: "Dr. Kavita Segwal" },
            "EVS": { theory: "Dr. Komal Mehra", lab: "Dr. Komal Mehra" },
            "EM": { theory: "Dr. Neeta Sharma" },
            "SMT-1": { theory: "Ms. Seema Sharma" },
            "EG-I": { theory: "Dr. Neeta Sharma" },
            "CS": { theory: "Dr. Shobha Tiwari Ray" },
            "PDP": { theory: "Dr. Shobha Tiwari Ray" }
        },
        timetable: {
            MONDAY: ["LAB:G1=PPS@102C,G2=EG-I@8", "~", "SMT-1", "EVS", "PPS", "DECO", "LAB:G1=EP-I@101,G2=PPS@102C", "~"],
            TUESDAY: ["EVS", "EP-I", "DECO", "SMT-1", "EM", "CS", "ENR", "~"],
            WEDNESDAY: ["LAB:G1=EG-I@8,G2=EP-I@101", "~", "CS", "EP-I", "LAB:G1=EVS@116,G2=LIB", "~", "PDP", "LIB"],
            THURSDAY: ["CS", "LIB", "PPS", "SMT-1", "EM", "DECO", "ENR", "~"],
            FRIDAY: ["EM", "DECO", "LAB:G1=DECO@307,G2=EVS@116", "~", "EP-I", "PPS", "LIB", "LAB:G2=DECO@307"]
        }
    },
    {
        branch: "ECE", section: "B", room: "312",
        faculty: {
            "PPS": { theory: "Ms. Vidhu Jain", lab: "Ms. Vidhu Jain (G1) / Ms. Suman Sehrawat (G2)" },
            "DECO": { theory: "Dr. Akash Rathee", lab: "Dr. Akash Rathee" },
            "EP-I": { theory: "Dr. Kavita Segwal", lab: "Dr. Kavita Segwal" },
            "EVS": { theory: "Dr. Komal Mehra", lab: "Dr. Komal Mehra" },
            "EM": { theory: "Dr. Neeta Sharma" },
            "SMT-1": { theory: "Dr. Gunjan Goyal" },
            "EG-I": { theory: "Mr. Pradeep Kumar" },
            "CS": { theory: "Dr. Shobha Tiwari Ray" },
            "PDP": { theory: "Dr. Shobha Tiwari Ray" }
        },
        timetable: {
            MONDAY: ["PPS", "SMT-1", "DECO", "EM", "EP-I", "EVS", "LIB", "LAB:G2=EP-I@101"],
            TUESDAY: ["CS", "SMT-1", "PPS", "EP-I", "LIB", "DECO", "PDP", "LIB"],
            WEDNESDAY: ["EVS", "PPS", "LAB:G1=EVS@116,G2=DECO@307", "~", "CS", "EVS", "LAB:G1=DECO@307", "~"],
            THURSDAY: ["LAB:G1=PPS@102B,G2=EG-I@8", "~", "EM", "CS", "LAB:G1=EG-I@8,G2=LIB", "~", "ENR", "~"],
            FRIDAY: ["LAB:G1=PPS@102B,G2=DECO@307", "~", "DECO", "EP-I", "SMT-1", "EM", "ENR", "~"]
        }
    },
    {
        branch: "CSE(DS)", section: "A", room: "113",
        faculty: {
            "PPS": { theory: "Prof. Rakesh Arora", lab: "Prof. Rakesh Arora" },
            "BEE": { theory: "Ms. Shalini", lab: "Ms. Shalini" },
            "EP-I": { theory: "Dr. Arvind Sharma", lab: "Dr. Arvind Sharma" },
            "EVS": { theory: "Lectures Assigned", lab: "Dr. Priya Takkar (G1) / Dr. Komal Mehra (G2)" },
            "EM": { theory: "Ms. Deepshikha" },
            "SMT-1": { theory: "Ms. Seema Sharma" },
            "EG-I": { theory: "Dr. Rajesh Kumar (G1) / Ms. Deepshikha (G2)" },
            "HVE": { theory: "Ms. Mehak Talwar" },
            "PDP": { theory: "Ms. Mehak Talwar" }
        },
        timetable: {
            MONDAY: ["EM", "BEE", "LIB", "SMT-1", "HVE", "EP-I", "LAB:G1=PPS@313A,G2=LIB", "~"],
            TUESDAY: ["PPS", "EM", "EVS", "EP-I", "BEE", "PDP", "LAB:G1=EP-I@101,G2=PPS@313A", "~"],
            WEDNESDAY: ["LAB:G1=EVS@116,G2=BEE@202", "~", "PPS", "EVS", "EM", "ENR", "~", "~"],
            THURSDAY: ["HVE", "BEE", "SMT-1", "EP-I", "LAB:G1=LIB,G2=EVS@116", "~", "ENR", "~"],
            FRIDAY: ["LAB:G1=BEE@202,G2=EG-I@8", "~", "PPS", "SMT-1", "LAB:G1=EG-I@8,G2=EP-I@101", "~", "ENR", "~"]
        }
    },
    {
        branch: "CSE(DS)", section: "B", room: "114",
        faculty: {
            "PPS": { theory: "Prof. Rakesh Arora", lab: "Prof. Rakesh Arora" },
            "BEE": { theory: "Ms. Shalini", lab: "Ms. Shalini" },
            "EP-I": { theory: "Dr. Arvind Sharma", lab: "Dr. Arvind Sharma" },
            "EVS": { theory: "Lectures Assigned", lab: "Dr. Liza Sarma (G1) / Dr. Komal Mehra (G2)" },
            "EM": { theory: "Ms. Deepshikha" },
            "SMT-1": { theory: "Ms. Seema Sharma" },
            "EG-I": { theory: "Mr. Pradeep Sharma (G1) / Dr. Pooja Rani (G2)" },
            "HVE": { theory: "Ms. Mehak Talwar" },
            "PDP": { theory: "Ms. Mehak Talwar" }
        },
        timetable: {
            MONDAY: ["EP-I", "SMT-1", "PPS", "LIB", "BEE", "LIB", "LAB:G1=EVS@116,G2=LIB", "~"],
            TUESDAY: ["LAB:G1=BEE@202,G2=EP-I@101", "~", "SMT-1", "EVS", "PPS", "EM", "LAB:G1=EVS@116,G2=LIB", "~"],
            WEDNESDAY: ["EM", "HVE", "LIB", "EP-I", "BEE", "ENR", "~", "~"],
            THURSDAY: ["LAB:G1=EG-I@8,G2=EP-I@101", "~", "HVE", "EM", "BEE", "LIB", "LAB:G1=PPS@211,G2=EG-I@8", "~"],
            FRIDAY: ["PPS", "EP-I", "SMT-1", "BEE", "EVS", "PDP", "LIB", "LAB:G2=PPS@211"]
        }
    },
    {
        branch: "EEE", section: "A", room: "115",
        faculty: {
            "AM-I": { theory: "Dr. Gunjan Goyal" },
            "ES": { theory: "Mr. Anand Vardhan", lab: "Ms. Rohini" },
            "AP-I": { theory: "Prof. Abhijit Nayak", lab: "Prof. Abhijit Nayak" },
            "AC": { theory: "Dr. Priya Takkar", lab: "Dr. Liza Sarma / Dr. Komal Mehra" },
            "MP": { theory: "Ms. Deepshikha" },
            "EG-I": { theory: "Ms. Deepshikha" },
            "HVE": { theory: "Dr. Shobha Tiwari Ray" },
            "PDP": { theory: "Dr. Shobha Tiwari Ray" }
        },
        timetable: {
            MONDAY: ["ES", "LIB", "LAB:G1=EG-I@8,G2=LIB", "~", "AM-I", "AC", "ENR", "~"],
            TUESDAY: ["LAB:G1=LIB,G2=AP-I@8", "~", "AM-I", "AP-I", "LAB:G1=ES@202,G2=LIB", "~", "ENR", "~"],
            WEDNESDAY: ["AM-I", "AP-I", "MP", "ES", "AC", "PDP", "ENR", "~"],
            THURSDAY: ["AP-I", "HVE", "LAB:G1=AP-I@101,G2=AC@116", "~", "MP", "LIB", "LAB:G1=ES@202", "~"],
            FRIDAY: ["HVE", "AC", "LAB:G1=AC@116,G2=EG-I@8", "~", "MP", "ES", "ENR", "~"]
        }
    }
];

// GGSIPU-style branch codes used to build enrolment numbers.
const BRANCH_CODES = {
    "CSE": "105",
    "CSE(DS)": "145",
    "IT": "108",
    "ECE": "131",
    "EEE": "120"
};

const BRANCH_NAMES = {
    "CSE": "Computer Science and Engineering",
    "CSE(DS)": "Computer Science and Engineering (Data Science)",
    "IT": "Information Technology",
    "ECE": "Electronics and Communication Engineering",
    "EEE": "Electrical and Electronics Engineering"
};

/**
 * Expands the compact notation into one row per (day, period, batch).
 * A "~" continues the block that started in an earlier period.
 */
function expandTimetable(sectionDef) {
    const slots = [];

    for (const day of DAYS) {
        const row = sectionDef.timetable[day] || [];
        let carried = null;

        row.forEach((cell, index) => {
            const period = index + 1;

            if (cell === "~") {
                if (!carried) return;
                carried.forEach(entry => slots.push({ ...entry, day, period }));
                return;
            }

            carried = null;
            if (!cell || cell === "-") return;

            if (cell.startsWith("LAB:")) {
                const entries = cell.slice(4).split(",").map(part => {
                    const [group, rest] = part.split("=");
                    const [code, room] = rest.split("@");
                    return {
                        subjectCode: code,
                        type: code === "LIB" ? "LIBRARY" : code === "ENR" ? "ENRICHMENT" : "LAB",
                        batch: group,
                        room: room || sectionDef.room
                    };
                });
                carried = entries;
                entries.forEach(entry => slots.push({ ...entry, day, period }));
                return;
            }

            const entry = {
                subjectCode: cell,
                type: cell === "LIB" ? "LIBRARY" : cell === "ENR" ? "ENRICHMENT" : "THEORY",
                batch: null,
                room: sectionDef.room
            };
            carried = [entry];
            slots.push({ ...entry, day, period });
        });
    }

    return slots;
}

/** Subject codes a section is actually taught (excludes LIB/ENR). */
function subjectCodesFor(sectionDef) {
    return Object.keys(sectionDef.faculty).filter(code => code !== "LIB" && code !== "ENR");
}

/** Codes that count towards attendance for a section. */
function attendanceSubjectsFor(sectionDef) {
    return subjectCodesFor(sectionDef).filter(code => !NON_ACADEMIC.includes(code));
}

module.exports = {
    PERIODS,
    LUNCH,
    DAYS,
    SUBJECTS,
    NON_ACADEMIC,
    SECTIONS,
    BRANCH_CODES,
    BRANCH_NAMES,
    expandTimetable,
    subjectCodesFor,
    attendanceSubjectsFor
};

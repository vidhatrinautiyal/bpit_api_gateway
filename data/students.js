/**
 * First-year student roster for 2026-27, Semester 1.
 *
 * Enrolment numbers follow the GGSIPU pattern used at BPIT:
 *   035 (college) + branch code + 3-digit roll + 2-digit admission year.
 *
 * Every account is seeded with the password below so the roster can be
 * demonstrated; change or remove this before any real deployment.
 */
const DEFAULT_PASSWORD = "Bpit@2026";

const ROSTER = {
    "CSE-A": [
        "Vidhatri Nautiyal",
        "Aditya Raghav",
        "Ishita Malhotra",
        "Rohan Bhatia",
        "Ananya Sethi",
        "Kabir Chaudhary"
    ],
    "CSE-B": [
        "Nikhil Verma",
        "Tanya Aggarwal",
        "Harshit Goel",
        "Mehak Arora",
        "Devansh Rawat",
        "Priyanshi Jain"
    ],
    "CSE-C": [
        "Arjun Nautiyal",
        "Simran Kaur",
        "Yash Chopra",
        "Riya Bansal",
        "Mohit Saxena",
        "Naina Sharma"
    ],
    "IT-A": [
        "Vaibhav Kanojia",
        "Sneha Pillai",
        "Rachit Dua",
        "Kritika Negi",
        "Armaan Siddiqui",
        "Palak Mittal"
    ],
    "IT-B": [
        "Shaurya Pratap",
        "Diya Kapoor",
        "Aryan Thakur",
        "Bhavya Gupta",
        "Rehan Ansari",
        "Muskan Yadav"
    ],
    "IT-C": [
        "Kunal Mehta",
        "Aisha Qureshi",
        "Pranav Joshi",
        "Sanya Grover",
        "Dev Tomar",
        "Anushka Rana"
    ],
    "ECE-A": [
        "Raghav Dhingra",
        "Zoya Farooqui",
        "Siddharth Menon",
        "Nandini Tyagi",
        "Ayush Bisht",
        "Trisha Bajaj"
    ],
    "ECE-B": [
        "Karan Ahluwalia",
        "Meher Sodhi",
        "Ritvik Chauhan",
        "Jasleen Sethi",
        "Abhinav Pandey",
        "Saloni Kashyap"
    ],
    "CSE(DS)-A": [
        "Manav Sachdeva",
        "Aarohi Deshmukh",
        "Tushar Bhardwaj",
        "Nishtha Kohli",
        "Faizan Alam",
        "Vanshika Rathore"
    ],
    "CSE(DS)-B": [
        "Aryan Khurana",
        "Shreya Iyer",
        "Lakshay Sood",
        "Tanvi Bhalla",
        "Imran Sheikh",
        "Kavya Suri"
    ],
    "EEE-A": [
        "Gaurav Semwal",
        "Pooja Rawat",
        "Naveen Chandra",
        "Ritika Bhandari",
        "Sahil Gulati",
        "Aditi Panwar"
    ]
};

/** first.last@bpitindia.edu.in, de-duplicated by roll number. */
function emailFor(name, roll) {
    const parts = name.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/);
    const base = parts.length > 1 ? `${parts[0]}.${parts[parts.length - 1]}` : parts[0];
    return `${base}${roll}@bpitindia.edu.in`;
}

function usernameFor(name, enrolment) {
    const first = name.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/)[0];
    return `${first}${enrolment.slice(-5)}`;
}

/**
 * Expands the roster into seedable student records for one section.
 */
function studentsFor(branch, section, branchCode, { year = 1, semester = 1, admissionYear = "26", rollOffset = 0 } = {}) {
    const key = `${branch}-${section}`;
    const names = ROSTER[key] || [];

    return names.map((name, index) => {
        // Roll numbers run across the whole branch, not per section, so
        // CSE-A and CSE-B never mint the same enrolment number.
        const roll = String(rollOffset + index + 1).padStart(3, "0");
        const enrolment = `035${branchCode}${roll}${admissionYear}`;
        return {
            name,
            enrolmentNumber: enrolment,
            username: usernameFor(name, enrolment),
            email: emailFor(name, roll),
            password: DEFAULT_PASSWORD,
            branch,
            section,
            semester,
            year,
            // Lab batches are split down the middle of the roll list.
            batch: index < Math.ceil(names.length / 2) ? "G1" : "G2"
        };
    });
}

module.exports = { ROSTER, DEFAULT_PASSWORD, studentsFor };

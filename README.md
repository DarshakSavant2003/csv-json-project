# 📦 CSV → JSON Converter & PostgreSQL Importer

A Node.js application that converts CSV files into structured JSON, inserts them into a PostgreSQL database, and exports the parsed JSON into a local file.

---

## 🚀 Project Overview

This project was built as part of the **Kelp Global Node.js Coding Challenge**.  
It demonstrates CSV parsing **without third-party libraries**, JSON transformation, PostgreSQL integration, and data visualization via console output.

---

## 🧠 Features

✅ Parses CSV using a **custom RFC4180-style parser** (no CSV library used)  
✅ Converts rows into nested JSON structures  
✅ Stores data into PostgreSQL with **JSONB columns**  
✅ Automatically exports a `converted.json` file after import  
✅ Displays **age group percentage distribution** in console output  
✅ Supports **batch inserts** for performance  

---

## 🧩 Tech Stack

| Tool | Purpose |
|------|----------|
| **Node.js** | Backend runtime |
| **Express.js** | Web server |
| **PostgreSQL** | Database |
| **pg (node-postgres)** | Database client |
| **dotenv** | Environment configuration |
| **fs & readline** | File streaming and parsing |

---

## 🗂️ Folder Structure

csv-json-project/
├── app.js
├── csvParser.js
├── db.js
├── package.json
├── .env.example
├── create_table.sql
├── data/
│ ├── sample.csv
│ └── converted.json
└── README.md

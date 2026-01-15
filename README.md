# MateriaLive

**Warehouse Inventory & Delivery Tracking System for BEC Inc.**

A cloud-based application for tracking incoming materials, managing staging locations, and processing deliveries with signature capture.

## Features

- **PIN-Based Authentication** - Quick warehouse-friendly login
- **Visual Shelf Board** - Digital representation of your staging shelves (Will Call, Staging, Delivery, Long Term Storage)
- **PO Receiving** - Track incoming purchase orders and stage materials
- **Delivery Tracking** - Signature capture for material pickups
- **QR Code Support** - Link to Request IDs for quick lookups
- **Role-Based Access** - Admin, Warehouse, and Field user roles

## Default Users

| Username | PIN  | Role      | Description            |
|----------|------|-----------|------------------------|
| TSTEPPAN | 5668 | warehouse | Tim Steppan            |
| FGILIC   | 4214 | warehouse | Faton Gilic            |
| CAMES    | 7902 | admin     | Chris Ames (Admin)     |
| FIELD    | 1234 | field     | Field User (View Only) |

## Quick Start

### Prerequisites

- Node.js 18+ (32-bit for ComputerEase ODBC compatibility)
- npm or yarn

### Installation

```bash
# Navigate to the project directory
cd MateriaLive

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
MateriaLive/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── auth/          # Authentication endpoints
│   │   ├── board/         # Shelf board data
│   │   ├── dashboard/     # Dashboard stats
│   │   ├── delivery/      # Delivery processing
│   │   ├── pos/           # Purchase orders
│   │   ├── staging/       # Staging records
│   │   └── admin/         # Admin settings
│   ├── admin/             # Admin settings page
│   ├── board/             # Visual shelf board
│   ├── dashboard/         # Main dashboard
│   ├── delivery/          # Delivery & signature capture
│   └── receiving/         # PO receiving workflow
├── components/            # Reusable React components
├── lib/                   # Database and utilities
│   └── db.ts             # SQLite database + auth
└── public/               # Static assets
```

## Database Schema

The application uses SQLite with the following main tables:

- **users** - PIN-authenticated users with roles
- **locations** - Inventory locations (synced from ComputerEase)
- **staging_spots** - Individual shelf spots (W1A, S2B, D3C, etc.)
- **purchase_orders** - POs from ComputerEase
- **po_items** - PO line items
- **po_distributions** - Job/phase distribution
- **staging_records** - Items staged at locations
- **deliveries** - Signature capture records
- **qr_codes** - Generated QR codes per Request ID

## Staging Spot Layout

Based on your existing PPT layout:

- **Will Call Construction**: W1A-W2C (6 spots)
- **Will Call Service**: W3A-W4F (12 spots)
- **Staging in Warehouse**: S1A-S4C (12 spots)
- **Customer Delivery**: D1A-D3C (9 spots)
- **Long Term Storage**: LT-1A to LT-2C (6 spots)
- **Pending Returns**: PR-1, PR-2

## Workflow

1. **Request Created** - FormSite → ComputerEase (Request ID assigned)
2. **PO Created** - References Request ID
3. **Materials Received** - Logged in Receiving section
4. **Materials Staged** - Assigned to shelf spot with pack number
5. **Materials Picked Up** - Signature captured
6. **Signed Slip** - Ready for sync to ComputerEase attachments

## Phase 2: Local Agent (Coming Soon)

The Local Agent will:
- Run as a Windows service on your office network
- Connect to ComputerEase via 32-bit ODBC (DSN: "Company 0 - System")
- Sync POs, received items, and locations from ComputerEase
- Upload signed delivery slips as attachments to ComputerEase

## ComputerEase Integration

### Tables Referenced

- **icpo** - Purchase Orders
- **icpoitem** - PO Line Items  
- **icpodist** - Job/Phase Distribution
- **icreceived** - Received Items
- **iclocation** - Inventory Locations (where type=1)
- **jcjob** - Job Information
- **jcjobattachment** - Job Attachments (for signed slips)

### Attachment Path

Signed slips sync to: `\\ceserver\ComputerEase\data\0\jc\job.att\Material Documents\`

File naming: `[FORMSITE_ID] [YYMMDD] [SEQUENCE] [INITIAL+LASTNAME].pdf`
Example: `23677908 251106 001 CAMES.pdf`

## Environment Variables (for production)

```env
# Database
DB_PATH=/path/to/materialive.db

# Server
PORT=3000
NODE_ENV=production
```

## Development Notes

- Built with Next.js 14 (App Router)
- SQLite database via better-sqlite3
- TypeScript for type safety
- Responsive design for tablets and desktop

## Support

For issues or questions, contact the development team.

---

**MateriaLive** - Built for BEC Inc. Glendora Warehouse

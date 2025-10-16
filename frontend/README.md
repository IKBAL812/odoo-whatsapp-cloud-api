# Odoo WhatsApp Cloud API - Frontend

A Next.js-based frontend for managing WhatsApp conversations integrated with Odoo.

## About This Project

This frontend was created through AI-assisted development (vibe coding) while the developer focused on the backend implementation. This is a collaborative effort between human expertise in Odoo backend development and AI tooling for the Next.js frontend.

## Tech Stack

- **Framework**: Next.js 15.3.2 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Phosphor Icons
- **Backend**: Odoo JSON-RPC

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Yarn package manager
- Running Odoo backend with WhatsApp Cloud API module

### Installation

```bash
# Install dependencies
yarn install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Odoo configuration

# Run development server
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

```env
ODOO_JSONRPC_HOST=localhost
ODOO_JSONRPC_PORT=8069
ODOO_JSONRPC_PROTOCOL=http
ODOO_JSONRPC_DATABASE=your_database
```

## Available Scripts

- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn start` - Start production server
- `yarn lint` - Run ESLint

## Features

- Real-time message updates via Server-Sent Events (SSE)
- Multi-language support (English/Turkish)
- Responsive design (mobile and desktop)
- Contact management
- Message threading
- File attachments support
- Reply functionality
- Desktop notifications

## Project Structure

```plaintext
src/app/
├── api/           # API routes (proxy to Odoo)
├── components/    # React components
├── context/       # Context providers
├── hooks/         # Custom React hooks
├── lib/           # Utilities and helpers
└── locales/       # Translation files
```

## Development Notes

For detailed development guidelines, coding standards, and best practices, see [CLAUDE.md](./CLAUDE.md).

## Docker Deployment

```bash
docker compose up -d --build
```

## License

This project is part of the Odoo WhatsApp Cloud API integration.

---

**Note**: This is an active learning project. Contributions and feedback are welcome!

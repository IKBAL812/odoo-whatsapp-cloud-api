# Odoo WhatsApp Cloud API

An integration between WhatsApp Cloud API and Odoo ERP system with a modern Next.js frontend for managing conversations.

## What is this project?

This project provides a complete solution for integrating WhatsApp Business Cloud API with Odoo. It allows businesses to:

- Send and receive WhatsApp messages directly from Odoo
- Manage WhatsApp conversations through a dedicated web interface
- Link WhatsApp threads with Odoo partners
- Handle message attachments (images, videos, documents, audio)
- Track message status (sent, delivered, read)
- Reply to messages with threading support

## Project Structure

- **whatsapp_cloud_api_backend/** - Odoo module (Python)
- **frontend/** - Next.js web application

## Getting Started

### Backend (Odoo Module)

1. Copy `whatsapp_cloud_api_backend/` to your Odoo addons directory
2. Update the addons list and install the module
3. Configure your WhatsApp Business Cloud API credentials in Odoo

### Frontend (Next.js Application)

See [frontend/README.md](./frontend/README.md) for detailed setup instructions.

## Requirements

- **Backend**: Odoo 16.0+, Python 3.8+
- **Frontend**: Node.js 18+, Yarn

## License

LGPL-3

## Authors

- Ahmet Yiğit Budak - [Altinkaya Enclosures](https://github.com/altinkaya-opensource)
- Erol Develi - [GitHub](https://github.com/erlinberg)

import nodemailer from 'nodemailer';

export class MailService {
  private transporter;

  constructor() {
    if (!process.env.MAIL_USER || !process.env.MAIL_APP_PASS) {
      console.error('❌ Missing MAIL_USER or MAIL_APP_PASS in .env');
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_APP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  async sendMail(to: string, subject: string, html: string) {
    const mailOptions = {
      from: process.env.MAIL_USER,
      to,
      subject,
      html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent:', info.response);
      return info;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }
}

export default new MailService();

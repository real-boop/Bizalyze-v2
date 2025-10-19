import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(request: NextRequest) {
  try {
    const { name, email, message, title, userId, createdAt } = await request.json()

    // Validate required fields
    if (!name || !email || !message || !title) {
      return NextResponse.json({ 
        error: 'Name, email, title, and message are required' 
      }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ 
        error: 'Invalid email format' 
      }, { status: 400 })
    }

    // Validate message length (updated to match your UI)
    if (message.length < 30) {
      return NextResponse.json({ 
        error: 'Message must be at least 30 characters long' 
      }, { status: 400 })
    }

    // Validate title length
    if (title.length < 5) {
      return NextResponse.json({ 
        error: 'Title must be at least 5 characters long' 
      }, { status: 400 })
    }

    console.log('📧 [Support Ticket] Received support request from:', email)

    // Create transporter using Gmail SMTP
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // use TLS
      auth: {
        user: process.env.EMAIL_USER, // contact@bizalyze.app
        pass: process.env.EMAIL_PASS  // your 16-char app password
      }
    })

    // Send email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER, // contact@bizalyze.app
      to: process.env.EMAIL_USER,   // Send to yourself
      subject: `Support Request: ${title}`,
      replyTo: email, // So you can hit reply directly to the user
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
            New Support Request
          </h2>
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Subject:</h3>
            <p style="font-weight: bold; color: #1f2937;">${title}</p>
            
            <h3 style="margin-top: 20px; color: #374151;">Message:</h3>
            <p style="white-space: pre-wrap; line-height: 1.6;">${message}</p>
          </div>
          
          <!-- User Information - NO BOX, just plain text for easy deletion -->
          <div style="margin: 20px 0; padding: 20px 0 10px 0; border-top: 1px solid #e5e7eb;">
            <h4 style="margin-top: 0; margin-bottom: 10px; color: #374151; font-size: 14px;">User Information (Internal):</h4>
            <p style="margin: 0; font-size: 14px;"><strong>Name:</strong> ${name}</p>
            <p style="margin: 0; font-size: 14px;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 0; font-size: 14px;"><strong>User ID:</strong> ${userId || 'N/A'}</p>
            <p style="margin: 0; font-size: 14px;"><strong>Account Created:</strong> ${createdAt ? new Date(createdAt).toLocaleDateString() : 'N/A'}</p>
            <p style="margin: 0; font-size: 14px;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
            <p>This support request was submitted through the Bizalyze user settings page.</p>
            <p><strong>To reply:</strong> Simply reply to this email - it will go directly to ${email}</p>
          </div>
        </div>
      `,
      // Plain text version
      text: `
New Support Request

Subject: ${title}

Message:
${message}

User Information:
- Name: ${name}
- Email: ${email}
- User ID: ${userId || 'N/A'}
- Account Created: ${createdAt ? new Date(createdAt).toLocaleDateString() : 'N/A'}
- Submitted: ${new Date().toLocaleString()}

To reply: Simply reply to this email - it will go directly to ${email}

This support request was submitted through the Bizalyze user settings page.
      `
    })

    console.log('✅ [Support Ticket] Email sent successfully:', info.messageId)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Support request sent successfully' 
    })

  } catch (error) {
    console.error('❌ [Support Ticket] Failed to send email:', error)
    return NextResponse.json({ 
      error: 'Failed to send support request. Please try again.' 
    }, { status: 500 })
  }
}

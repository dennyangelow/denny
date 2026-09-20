// lib/ses.ts — SES транспортен слой
// Единственото място, което говори директно с Amazon SES.
// v2: добавен ConfigurationSetName — без него SES не праща delivered/
//     bounce/complaint/open/click събития към SNS топика (ses-events).

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

let _sesClient: SESClient | null = null

function getSESClient(): SESClient {
  if (_sesClient) return _sesClient

  const accessKeyId     = process.env.SES_ACCESS_KEY_ID
  const secretAccessKey = process.env.SES_SECRET_ACCESS_KEY
  const region           = process.env.SES_REGION || 'eu-north-1'

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('SES_ACCESS_KEY_ID / SES_SECRET_ACCESS_KEY не са зададени в env vars')
  }

  _sesClient = new SESClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  })

  return _sesClient
}

// Името на Configuration Set-а, създаден в SES конзолата
// (Amazon SES → Configuration sets → my-first-configuration-set).
const CONFIGURATION_SET = process.env.SES_CONFIGURATION_SET || 'my-first-configuration-set'

export interface SESEmailParams {
  to: string
  from: string
  subject: string
  html: string
}

export async function sendViaSES({ to, from, subject, html }: SESEmailParams) {
  const client = getSESClient()

  const command = new SendEmailCommand({
    Source: from,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body:    { Html: { Data: html, Charset: 'UTF-8' } },
    },
    ConfigurationSetName: CONFIGURATION_SET,
  })

  return client.send(command)
}

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const { App } = require('@slack/bolt');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const slackApp = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET
});

app.get("/", (req, res) => {
    res.send("Hello, World!");
  });

// Slash Command Handler
app.post('/slack/approval-test', async (req, res) => {
    const triggerId = req.body.trigger_id;
    
    const usersResponse = await axios.get('https://slack.com/api/users.list', {
        headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` }
    });
    
    const userOptions = usersResponse.data.members
        .filter(user => !user.is_bot && user.id !== 'USLACKBOT')
        .map(user => ({ text: { type: 'plain_text', text: user.name }, value: user.id }));
    
    const modal = {
        trigger_id: triggerId,
        view: {
            type: 'modal',
            callback_id: 'approval_modal',
            title: { type: 'plain_text', text: 'Approval Request' },
            blocks: [
                {
                    type: 'input',
                    block_id: 'approver_block',
                    element: {
                        type: 'static_select',
                        action_id: 'approver_selected',
                        options: userOptions
                    },
                    label: { type: 'plain_text', text: 'Select Approver' }
                },
                {
                    type: 'input',
                    block_id: 'approval_text',
                    element: {
                        type: 'plain_text_input',
                        action_id: 'approval_message'
                    },
                    label: { type: 'plain_text', text: 'Approval Details' }
                }
            ],
            submit: { type: 'plain_text', text: 'Submit' }
        }
    };
    
    await axios.post('https://slack.com/api/views.open', modal, {
        headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' }
    });
    res.send('');
});

// Handling Submission
slackApp.view('approval_modal', async ({ ack, body, view, client }) => {
    await ack();
    const approver = view.state.values.approver_block.approver_selected.selected_option.value;
    const requestText = view.state.values.approval_text.approval_message.value;
    
    await client.chat.postMessage({
        channel: approver,
        text: `Approval request: ${requestText}`,
        blocks: [
            {
                type: 'actions',
                elements: [
                    { type: 'button', text: { type: 'plain_text', text: 'Approve' }, value: 'approved', action_id: 'approve_request' },
                    { type: 'button', text: { type: 'plain_text', text: 'Reject' }, value: 'rejected', action_id: 'reject_request' }
                ]
            }
        ]
    });
});

// Handle Approve/Reject
slackApp.action('approve_request', async ({ ack, body, client }) => {
    await ack();
    await client.chat.postMessage({
        channel: body.user.id,
        text: '✅ Your request has been approved!'
    });
});

slackApp.action('reject_request', async ({ ack, body, client }) => {
    await ack();
    await client.chat.postMessage({
        channel: body.user.id,
        text: '❌ Your request has been rejected!'
    });
});

app.listen(3000, () => console.log('Slack bot is running on port 3000'));

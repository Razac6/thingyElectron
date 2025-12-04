import React, { useEffect, useState } from 'react';
import './Chat.css';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import Box from '@mui/material/Box';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { a11yDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

import {
  Alert,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Skeleton,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  TextField,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import Stack from '@mui/material/Stack';
import { Link, useNavigate } from 'react-router-dom';

let messagesStore: { role: string; content: string }[] = [];
let assistantName = 'assistant';
const defaultProps =
  'Jesteś pomocnikiem programisty. Wszystkie kody programistyczne wysyłaj w markdown to ważne. Znajdź dla siebie losowe imię z bohaterów gwiezdnych wojen. Po tej wiadomości tylko się przywitaj. Cos w stylu cześć nazywam się... (wstaw wylosowane imię w nawiasy []) w czym mogę ci pomóc?';

export default function Chat(props: { message: string }) {
  // Zapisz użytkownika
  // window.electron.store.set('foo', 'bar');
  // or

  // console.log(window.electron.store.get('foo'));

  const navigate = useNavigate();
  const { message = defaultProps } = props;
  const [inputValue, setInputValue] = useState('');
  const [inputTokensValue, setInputTokensValue] = useState(100);
  const [inputTempValue, setInputTempValue] = useState(0.2);
  const [responseMessage, setResponseMessage] = useState('');
  const [showProgressBar, setShowProgressBar] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const actions = [
    { icon: <DeleteIcon />, name: 'Delete' },
    { icon: <ArrowBackIcon />, name: 'Back' },
  ];

  const handleSubmit = async (event: any) => {
    event.preventDefault();
    setShowAlert(false);
    const userContent = { role: 'user', content: `${inputValue}` };
    try {
      setShowProgressBar((prevShowProgressBar) => !prevShowProgressBar);
      
      // Mock response for offline mode
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      messagesStore.push(userContent);
      const assistantMessage = { role: 'assistant', content: "I am currently offline. Please connect to the internet or configure a local LLM." };
      messagesStore.push(assistantMessage);
      setResponseMessage(assistantMessage.content);
      setInputValue('');
      setShowProgressBar((prevShowProgressBar) => !prevShowProgressBar);
    } catch (error) {
      setShowProgressBar((prevShowProgressBar) => !prevShowProgressBar);
      console.error(error);
      setShowAlert(true);
    }
  };

  const handleInputChange = (event: any) => {
    setInputValue(event.target.value);
  };

  const handleInputTokensChange = (event: any) => {
    setInputTokensValue(Number(event.target.value));
  };

  const handleInputTempChange = (event: any) => {
    setInputTempValue(Number(event.target.value));
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  const handleClick = (actionName: string) => {
    switch (actionName) {
      case 'Delete':
        messagesStore = [];
        setResponseMessage('');
        setInputTokensValue(100);
        initGtp();
        break;
      case 'Back':
        messagesStore = [];
        setResponseMessage('');
        setInputTokensValue(100);
        navigate('/');
        break;
      default:
        break;
    }
  };

  async function initGtp() {
    try {
      setShowProgressBar((prevShowProgressBar) => !prevShowProgressBar);
      
      // Mock response for offline mode
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const assistantMessage = { role: 'assistant', content: "Hello! I am your offline assistant. Chat features are currently limited." };
      messagesStore.push(assistantMessage);
      setResponseMessage(assistantMessage.content);
      setShowProgressBar((prevShowProgressBar) => !prevShowProgressBar);
    } catch (error) {
      setShowProgressBar((prevShowProgressBar) => !prevShowProgressBar);
      console.error(error);
      setShowAlert(true);
    }
  }

  useEffect(() => {
    initGtp();
  }, []);
  return (
    <div>
      <SpeedDial
        ariaLabel="SpeedDial basic example"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        icon={<SpeedDialIcon />}
      >
        {actions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={() => handleClick(action.name)}
          />
        ))}
      </SpeedDial>
      <div>
        <Grid display="flex" justifyContent="center" alignItems="center">
          <Stack
            direction="row"
            sx={{ position: 'fixed', bottom: 10, marginTop: 17 }}
            spacing={1}
          >
            <form onSubmit={handleSubmit}>
              <Box
                sx={{
                  minWidth: 500,
                  width: '100%',
                }}
              >
                <TextField
                  fullWidth
                  label="Send a message..."
                  variant="standard"
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  multiline
                  maxRows={4}
                />
              </Box>
            </form>
            <form className="formMsg">
              <TextField
                sx={{
                  width: { sm: 100, md: 100 },
                  marginRight: 1,
                }}
                label="Tokens"
                variant="standard"
                value={inputTokensValue}
                onChange={handleInputTokensChange}
              />
              <FormControl>
                <InputLabel id="temper">Temp</InputLabel>
                <Select
                  sx={{
                    width: { sm: 60, md: 60 },
                  }}
                  labelId="temper"
                  variant="standard"
                  value={inputTempValue}
                  label="Temperature"
                  onChange={handleInputTempChange}
                >
                  <MenuItem value={0}>0</MenuItem>
                  <MenuItem value={0.2}>0.2</MenuItem>
                  <MenuItem value={0.3}>0.3</MenuItem>
                  <MenuItem value={0.4}>0.4</MenuItem>
                  <MenuItem value={0.7}>0.7</MenuItem>
                </Select>
              </FormControl>
            </form>
          </Stack>
        </Grid>
        <List
          sx={{
            width: '100%',
            bgcolor: 'background.paper',
            position: 'relative',
            overflow: 'auto',
            maxHeight: 500,
            minWidth: 500,
            paddingBottom: 5,
          }}
        >
          {messagesStore.map(({ role, content }, index) => {
            const codeRegex = /```(.*?)```/gs; // używamy flagi 's' (dotAll) aby uwzględnić nowe linie
            const matches = content.match(codeRegex);
            const matches2 = content.match(/\[(.*?)\]/);

            if (matches2) {
              const extract = matches2[1];
              assistantName = extract;
            }
            let formattedContent = content;
            if (matches && matches[0]) {
              const code = matches[0].replace(/```/g, ''); // usuwamy wszystkie wystąpienia '```'
              formattedContent = (
                <SyntaxHighlighter
                  language="typescript"
                  showLineNumbers="true"
                  style={a11yDark}
                >
                  {code}
                </SyntaxHighlighter>
              );
            }
            const primary = role === 'assistant' ? assistantName : role;
            return (
              <ListItem key={index + content}>
                <ListItemText primary={primary} secondary={formattedContent} />
              </ListItem>
            );
          })}
        </List>

        <Box sx={{ width: '100%' }}>
          {showProgressBar && (
            <div>
              <Skeleton />
              <Skeleton animation="wave" />
              <Skeleton animation={false} />
            </div>
          )}
        </Box>
        <Box sx={{ width: '100%' }}>
          {showAlert && (
            <div>
              <Alert severity="error">Something went wrong...</Alert>
            </div>
          )}
        </Box>
      </div>
    </div>
  );
}

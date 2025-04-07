import React, { useEffect, useState, useCallback, useRef } from "react";
import { ChatState } from "../Context/ChatProvider";
import {
  Box,
  FormControl,
  IconButton,
  Input,
  Spinner,
  Text,
  useToast,
  Tooltip
} from "@chakra-ui/react";
import { ArrowBackIcon, WarningIcon, CheckCircleIcon } from "@chakra-ui/icons";
import { getSender, getSenderFull } from "../config/ChatLogics";
import ProfileModal from "./miscellaneous/ProfileModal";
import UpdateGroupChatModal from "./miscellaneous/UpdateGroupChatModal";
import axios from "axios";
import ScrollableChat from "./ScrollableChat";
import { io } from "socket.io-client";
import Lottie from "react-lottie";
import animationData from "../animations/typing.json";

const SingleChat = ({ fetchAgain, setFetchAgain }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const notificationSoundRef = useRef(null);
  const socketRef = useRef(null);

  const defaultOptions = {
    loop: true,
    autoplay: true,
    animationData: animationData,
    rendererSettings: {
      preserveAspectRatio: "xMidYMid slice",
    },
  };

  const { user, selectedChat, setSelectedChat, notification, setNotification } =
    ChatState();
  const toast = useToast();

  // Initialize notification sound
  useEffect(() => {
    notificationSoundRef.current = new Audio("/sounds/notification.wav");
    notificationSoundRef.current.load();
    
    return () => {
      if (notificationSoundRef.current) {
        notificationSoundRef.current.pause();
        notificationSoundRef.current = null;
      }
    };
  }, []);

  // Clear notifications when chat is opened
  useEffect(() => {
    if (selectedChat) {
      const updatedNotifications = notification.filter(
        (notif) => notif.chat._id !== selectedChat._id
      );
      
      if (updatedNotifications.length !== notification.length) {
        setNotification(updatedNotifications);
        setFetchAgain(!fetchAgain);
      }
    }
  }, [selectedChat, notification, setNotification, setFetchAgain, fetchAgain]);

  const fetchMessages = useCallback(async () => {
    if (!selectedChat) return;

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
        withCredentials: true // Ensure credentials are sent with requests
      };

      setLoading(true);
      const { data } = await axios.get(
        `/api/message/${selectedChat._id}`,
        config
      );
      setMessages(data);
      setLoading(false);

      if (socketRef.current) {
        socketRef.current.emit("join chat", selectedChat._id);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load messages",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  }, [selectedChat, user.token, toast]);

  // Initialize socket connection with enhanced configuration
  useEffect(() => {
    const ENDPOINT = process.env.NODE_ENV === 'development'
      ? "http://localhost:5000"
      : "https://viper-chat.onrender.com";

    socketRef.current = io(ENDPOINT, {
      path: "/socket.io",
      transports: ["websocket", "polling"], // Enable both transports
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      pingTimeout: 30000,
      pingInterval: 15000,
      autoConnect: true,
      secure: process.env.NODE_ENV === 'production',
      rejectUnauthorized: false // Only for development/testing
    });

    const socket = socketRef.current;

    const handleConnect = () => {
      setSocketConnected(true);
      setConnectionStatus("connected");
      console.log("Connected to WebSocket server");
      
      // Re-setup user after reconnection
      if (user) {
        socket.emit("setup", user);
      }
    };

    const handleDisconnect = (reason) => {
      setSocketConnected(false);
      setConnectionStatus("disconnected");
      console.log(`Disconnected from WebSocket server. Reason: ${reason}`);
    };

    const handleConnectError = (err) => {
      console.log("Connection error:", err);
      setConnectionStatus("error");
      toast({
        title: "Connection Error",
        description: "Failed to connect to chat server",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top-right"
      });
    };

    const handleReconnecting = (attempt) => {
      setConnectionStatus(`reconnecting (attempt ${attempt})`);
      console.log(`Reconnecting attempt ${attempt}`);
    };

    const handleReconnectFailed = () => {
      setConnectionStatus("failed");
      toast({
        title: "Connection Failed",
        description: "Could not reconnect to chat server",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top-right"
      });
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("reconnecting", handleReconnecting);
    socket.on("reconnect_failed", handleReconnectFailed);
    socket.on("typing", (userId) => {
      if (userId !== user?._id) {
        setTypingUser(userId);
        setIsTyping(true);
      }
    });
    socket.on("stop typing", () => {
      setIsTyping(false);
      setTypingUser("");
    });

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("reconnecting", handleReconnecting);
      socket.off("reconnect_failed", handleReconnectFailed);
      socket.off("typing");
      socket.off("stop typing");
      
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [user, toast]);

  // Setup user and fetch messages when selectedChat changes
  useEffect(() => {
    if (user && socketRef.current?.connected) {
      socketRef.current.emit("setup", user);
      fetchMessages();
    }
  }, [user, fetchMessages]);

  // Message received handler with notification sound
  useEffect(() => {
    const handleMessageReceived = (newMessage) => {
      if (!selectedChat || selectedChat._id !== newMessage.chat._id) {
        try {
          if (notificationSoundRef.current) {
            notificationSoundRef.current.currentTime = 0;
            notificationSoundRef.current.play().catch(e => {
              console.log("Audio playback prevented:", e);
              toast({
                title: "New message",
                description: "You have a new message",
                status: "info",
                duration: 3000,
                isClosable: true,
                position: "top-right"
              });
            });
          }
        } catch (err) {
          console.error("Notification sound error:", err);
        }

        if (!notification.some((n) => n._id === newMessage._id)) {
          setNotification([newMessage, ...notification]);
          setFetchAgain(!fetchAgain);
        }
      } else {
        setMessages((prev) => [...prev, newMessage]);
      }
    };

    if (socketRef.current) {
      socketRef.current.on("message received", handleMessageReceived);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off("message received", handleMessageReceived);
      }
    };
  }, [selectedChat, notification, setNotification, fetchAgain, setFetchAgain, toast]);

  const sendMessage = async (event) => {
    if (event.key === "Enter" && newMessage && socketRef.current) {
      try {
        // Stop typing indicator before sending
        if (isTypingRef.current) {
          socketRef.current.emit("stop typing", {
            chatId: selectedChat._id,
            userId: user._id
          });
          isTypingRef.current = false;
        }
        
        const config = {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
          withCredentials: true
        };

        setNewMessage("");
        const { data } = await axios.post(
          "/api/message",
          { content: newMessage, chatId: selectedChat._id },
          config
        );

        socketRef.current.emit("new message", data);
        setMessages((prev) => [...prev, data]);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to send message",
          status: "error",
          duration: 5000,
          isClosable: true,
          position: "top-right"
        });
        setNewMessage(newMessage); // Restore the message if sending failed
      }
    }
  };

  const typingHandler = (e) => {
    setNewMessage(e.target.value);

    if (!socketConnected || !selectedChat || !socketRef.current) return;

    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Start typing indicator if there's text
    if (e.target.value.length > 0) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        socketRef.current.emit("typing", {
          chatId: selectedChat._id,
          userId: user._id
        });
      }
      
      // Set timeout to stop typing indicator after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current) {
          isTypingRef.current = false;
          socketRef.current.emit("stop typing", {
            chatId: selectedChat._id,
            userId: user._id
          });
        }
      }, 2000);
    } else if (isTypingRef.current) {
      // Stop typing if input is empty
      isTypingRef.current = false;
      socketRef.current.emit("stop typing", {
        chatId: selectedChat._id,
        userId: user._id
      });
    }
  };

  // Clean up timeouts when component unmounts
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Ensure we stop typing indicator when leaving the chat
      if (isTypingRef.current && socketRef.current) {
        socketRef.current.emit("stop typing", {
          chatId: selectedChat?._id,
          userId: user._id
        });
      }
    };
  }, [selectedChat?._id, user._id]);

  const getConnectionStatusIcon = () => {
    switch(connectionStatus) {
      case "connected":
        return <CheckCircleIcon color="green.500" />;
      case "error":
      case "failed":
        return <WarningIcon color="red.500" />;
      default:
        return <WarningIcon color="orange.500" />;
    }
  };

  return (
    <>
      {selectedChat ? (
        <>
          <Text
            fontSize={{ base: "28px", md: "30px" }}
            pb={3}
            px={2}
            w="100%"
            fontFamily="roboto"
            display="flex"
            justifyContent={{ base: "space-between" }}
            alignItems="center"
          >
            <IconButton
              display={{ base: "flex", md: "none" }}
              icon={<ArrowBackIcon />}
              onClick={() => setSelectedChat("")}
              aria-label="Back to chats"
            />
            {selectedChat.isGroupChat ? (
              <>
                {selectedChat.chatName.toUpperCase()}
                <UpdateGroupChatModal
                  fetchAgain={fetchAgain}
                  setFetchAgain={setFetchAgain}
                  fetchMessages={fetchMessages}
                />
              </>
            ) : (
              <>
                {getSender(user, selectedChat.users)}
                <ProfileModal user={getSenderFull(user, selectedChat.users)} />
              </>
            )}
            <Tooltip label={`Connection: ${connectionStatus}`}>
              <Box display="flex" alignItems="center" ml={2}>
                {getConnectionStatusIcon()}
              </Box>
            </Tooltip>
          </Text>

          <Box
            display="flex"
            flexDir="column"
            justifyContent="flex-end"
            p={3}
            bg="#E8E8E8"
            w="100%"
            h="100%"
            borderRadius="lg"
            overflow="hidden"
          >
            {loading ? (
              <Spinner
                size="xl"
                w={20}
                h={20}
                alignSelf="center"
                margin="auto"
              />
            ) : (
              <ScrollableChat messages={messages} />
            )}

            <FormControl onKeyDown={sendMessage} isRequired mt={3}>
              {isTyping && typingUser !== user._id && (
                <Box mb={2} ml={2}>
                  <Text fontSize="sm" color="gray.500">
                    {selectedChat.isGroupChat 
                      ? `${getSender(user, [{ _id: typingUser }])} is typing...`
                      : "Typing..."}
                  </Text>
                  <Lottie
                    options={defaultOptions}
                    width={70}
                    style={{ marginTop: 5 }}
                  />
                </Box>
              )}
              <Input
                variant="filled"
                bg="#E0E0E0"
                placeholder={socketConnected ? "Type a message..." : "Connecting to chat..."}
                onChange={typingHandler}
                value={newMessage}
                isDisabled={!socketConnected}
                _disabled={{
                  cursor: "not-allowed",
                  bg: "gray.100"
                }}
              />
            </FormControl>
          </Box>
        </>
      ) : (
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          h="100%"
        >
          <Text fontSize="3xl" pb={3} fontFamily="roboto">
            Click on a user to start chatting
          </Text>
        </Box>
      )}
    </>
  );
};

export default SingleChat;
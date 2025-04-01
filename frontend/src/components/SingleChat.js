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
} from "@chakra-ui/react";
import { ArrowBackIcon } from "@chakra-ui/icons";
import { getSender, getSenderFull } from "../config/ChatLogics";
import ProfileModal from "./miscellaneous/ProfileModal";
import UpdateGroupChatModal from "./miscellaneous/UpdateGroupChatModal";
import axios from "axios";
import ScrollableChat from "./ScrollableChat";
import { io } from "socket.io-client";
import Lottie from "react-lottie";
import animationData from "../animations/typing.json";

const ENDPOINT = "http://localhost:5000";
let socket;

const SingleChat = ({ fetchAgain, setFetchAgain }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState("");
  
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const notificationSoundRef = useRef(null);

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
    notificationSoundRef.current = new Audio(process.env.PUBLIC_URL + "/sounds/notification.wav");
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
      };

      setLoading(true);
      const { data } = await axios.get(
        `/api/message/${selectedChat._id}`,
        config
      );
      setMessages(data);
      setLoading(false);

      socket.emit("join chat", selectedChat._id);
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

  // Initialize socket connection
  useEffect(() => {
    socket = io(ENDPOINT, {
      transports: ["websocket"],
      withCredentials: true,
    });

    socket.on("connect", () => {
      setSocketConnected(true);
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    socket.on("typing", (userId) => {
      if (userId !== user._id) {
        setTypingUser(userId);
        setIsTyping(true);
      }
    });

    socket.on("stop typing", () => {
      setIsTyping(false);
      setTypingUser("");
    });

    return () => {
      socket.disconnect();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [user._id]);

  // Setup user and fetch messages when selectedChat changes
  useEffect(() => {
    if (user && socket) {
      socket.emit("setup", user);
      fetchMessages();
    }
  }, [user, fetchMessages]);

  // Message received handler with notification sound
  useEffect(() => {
    const handleMessageReceived = (newMessage) => {
      // Play notification sound for new messages in other chats
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

    socket.on("message received", handleMessageReceived);

    return () => {
      socket.off("message received", handleMessageReceived);
    };
  }, [selectedChat, notification, setNotification, fetchAgain, setFetchAgain, toast]);



  const sendMessage = async (event) => {
    if (event.key === "Enter" && newMessage) {
      try {
        // Stop typing indicator before sending
        if (isTypingRef.current) {
          socket.emit("stop typing", {
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
        };

        setNewMessage("");
        const { data } = await axios.post(
          "/api/message",
          { content: newMessage, chatId: selectedChat._id },
          config
        );

        socket.emit("new message", data);
        setMessages((prev) => [...prev, data]);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to send message",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    }
  };

  const typingHandler = (e) => {
    setNewMessage(e.target.value);

    if (!socketConnected || !selectedChat) return;

    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Start typing indicator if there's text
    if (e.target.value.length > 0) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        socket.emit("typing", {
          chatId: selectedChat._id,
          userId: user._id
        });
      }
      
      // Set timeout to stop typing indicator after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current) {
          isTypingRef.current = false;
          socket.emit("stop typing", {
            chatId: selectedChat._id,
            userId: user._id
          });
        }
      }, 2000);
    } else if (isTypingRef.current) {
      // Stop typing if input is empty
      isTypingRef.current = false;
      socket.emit("stop typing", {
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
      if (isTypingRef.current) {
        socket.emit("stop typing", {
          chatId: selectedChat?._id,
          userId: user._id
        });
      }
    };
  }, [selectedChat?._id, user._id]);

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
                placeholder="Type a message..."
                onChange={typingHandler}
                value={newMessage}
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
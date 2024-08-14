import React, { useEffect } from "react";
import { Container, Box, Heading } from "@chakra-ui/react";
import { Tabs, TabList, TabPanels, Tab, TabPanel } from "@chakra-ui/react";
import Login from "../components/Authentication/Login";
import Signup from "../components/Authentication/Signup";
import { useHistory } from "react-router-dom";

const HomePage = () => {
  const history = useHistory();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("userInfo"));
    if (user) history.push("/chats");
  }, [history]);

  return (
    <Container maxW="xl" centerContent>
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        flexDirection="column"
        padding={6}
        bg="white"
        w="100%"
        m="40px 0 15px 0"
        borderRadius="lg"
        borderWidth="1px"
        boxShadow="md"
      >
        <Heading as="h1" size="2xl" fontFamily="roboto" color="black" mb={4}>
          Viper-Chat
        </Heading>
        <Box w="100%" maxWidth="400px">
          <Tabs variant="soft-rounded" colorScheme="teal">
            <TabList mb="1em">
              <Tab>Sign In</Tab>
              <Tab>Sign Up</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <Login />
              </TabPanel>
              <TabPanel>
                <Signup />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
      </Box>
    </Container>
  );
};

export default HomePage;

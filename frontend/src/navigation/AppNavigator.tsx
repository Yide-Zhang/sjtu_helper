import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { LoginScreen } from '../screens/LoginScreen';
import { MainScreen } from '../screens/MainScreen';
import { AssignmentScreen } from '../screens/AssignmentScreen';
import { AnnouncementsScreen } from '../screens/AnnouncementsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SettingsEditScreen } from '../screens/SettingsEditScreen';
import { JAccountLoginScreen } from '../screens/JAccountLoginScreen';
import { ScheduleScreen } from '../screens/ScheduleScreen';
import { ExamsScreen } from '../screens/ExamsScreen';
import { ScoreDetailScreen } from '../screens/ScoreDetailScreen';
import { GradesScreen } from '../screens/GradesScreen';
import { MailScreen } from '../screens/MailScreen';
import { MailDetailScreen } from '../screens/MailDetailScreen';
import { ComposeMailScreen } from '../screens/ComposeMailScreen';
import { NotifScreen } from '../screens/NotifScreen';
import { WebViewScreen } from '../screens/WebViewScreen';
import { RenderTestScreen } from '../screens/RenderTestScreen';
import { CourseCommunityScreen } from '../screens/CourseCommunityScreen';
import { ActivityIndicator, View } from 'react-native';

const Stack = createStackNavigator();

export const AppNavigator = () => {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    // 不再强制要求首次登录 Canvas Token，
    // MainScreen 会通过警告横幅引导用户去设置。
    setInitialRoute('Main');
  }, []);

  if (initialRoute === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0055A8" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      >
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen 
          name="Main" 
          component={MainScreen} 
        />
        <Stack.Screen 
          name="Assignments" 
          component={AssignmentScreen} 
        />
        <Stack.Screen 
          name="Announcements" 
          component={AnnouncementsScreen} 
        />
        <Stack.Screen 
          name="Schedule" 
          component={ScheduleScreen} 
        />
        <Stack.Screen 
          name="Settings" 
          component={SettingsScreen} 
        />
        <Stack.Screen 
          name="JAccountLogin" 
          component={JAccountLoginScreen} 
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen 
          name="SettingsEdit" 
          component={SettingsEditScreen} 
        />
        <Stack.Screen 
          name="Exams" 
          component={ExamsScreen} 
        />
        <Stack.Screen 
          name="ScoreDetail" 
          component={ScoreDetailScreen} 
        />
        <Stack.Screen 
          name="Grades" 
          component={GradesScreen} 
        />
        <Stack.Screen 
          name="Mail" 
          component={MailScreen} 
        />
        <Stack.Screen 
          name="MailDetail" 
          component={MailDetailScreen} 
        />
        <Stack.Screen 
          name="ComposeMail" 
          component={ComposeMailScreen} 
        />
        <Stack.Screen 
          name="Notif" 
          component={NotifScreen} 
        />
        <Stack.Screen 
          name="WebView" 
          component={WebViewScreen} 
        />
        <Stack.Screen 
          name="CourseCommunity" 
          component={CourseCommunityScreen} 
        />
        <Stack.Screen 
          name="RenderTest" 
          component={RenderTestScreen} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
